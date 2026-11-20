// ---------------------------------------------------------------------------
// Shared helpers
//
// COURSE_DATA (from data.js) is the shared, read-only list of courses.
// Courses a student adds with the "Add course" popup are NOT written to it.
// They are kept in USER_COURSES and saved in this browser's localStorage, so
// they only appear for the person using this browser.
// ---------------------------------------------------------------------------
(function () {
  "use strict";

  var STORAGE_KEY = "workloadCalendar.userCourses.v1";

  function load() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch (e) {
      return {};          // storage blocked or corrupted: start empty
    }
  }

  window.USER_COURSES = load();   // { winter: [course], transition: [course] }

  window.saveUserCourses = function () {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(window.USER_COURSES));
      return true;
    } catch (e) {
      return false;       // e.g. private mode: course still works this session
    }
  };

  // "2026-01-05" -> "Jan 5, 2026" (built from parts so timezones can't shift it)
  window.formatDate = function (iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return "";
    return new Date(+m[1], +m[2] - 1, +m[3])
      .toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  // Builds one course tile (checkbox + label) and inserts it before the Add tile
  window.addCourseTile = function (category, course, id, options) {
    options = options || {};
    var toggle = document.getElementById("add-" + category);
    var grid = toggle.closest(".course-grid");

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = id;
    checkbox.name = category;
    checkbox.value = course.code;
    checkbox.checked = !!options.checked;

    var label = document.createElement("label");
    label.htmlFor = id;
    label.className = "course-tile";

    var code = document.createElement("span");
    code.className = "code";
    code.textContent = course.code;

    var name = document.createElement("span");
    name.className = "name";
    name.textContent = course.name || "";

    label.appendChild(code);
    label.appendChild(name);

    // Courses the student added themselves can be removed again
    if (options.removable) {
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "tile-remove";
      remove.setAttribute("aria-label", "Remove " + course.code);
      remove.textContent = "\u00D7";
      remove.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm("Remove " + course.code + " from your courses?")) return;
        var list = window.USER_COURSES[category] || [];
        var idx = list.indexOf(course);
        if (idx !== -1) list.splice(idx, 1);
        window.saveUserCourses();
        checkbox.remove();
        label.remove();
      });
      label.appendChild(remove);
    }

    // Courses the student added themselves get their own heading so they
    // aren't mistaken for part of a semester list
    if (options.removable && !grid.querySelector(".semester-heading.added")) {
      var added = document.createElement("h3");
      added.className = "semester-heading added";
      added.textContent = "Added courses";
      grid.insertBefore(added, toggle);
    }

    grid.insertBefore(checkbox, toggle);
    grid.insertBefore(label, toggle);
  };

  // Adds a heading (e.g. "Semester 1") before the Add tile
  window.addSemesterHeading = function (category, text) {
    var toggle = document.getElementById("add-" + category);
    var grid = toggle.closest(".course-grid");
    var h = document.createElement("h3");
    h.className = "semester-heading";
    h.textContent = text;
    grid.insertBefore(h, toggle);
  };
})();


// Build the course tiles: shared courses from data.js (grouped by semester, in
// the order below), then this user's own.
(function () {
  "use strict";
  var data = window.COURSE_DATA || {};

  // Display order for the Winter list. Edit here to reorder or regroup.
  var SEMESTERS = [
    { heading: "Semester 1", codes: ["CHY 102", "MTH 140", "MTH 141", "PCS 211"] },
    { heading: "Semester 2", codes: [
      "AER 222", "BME 100", "CHE 200", "CHY 211", "CPS 125", "CPS 188",
      "CVL 207", "ELE 202", "ECN 801", "MEC 222", "MTL 200", "MTH 240", "PCS 125"
    ] }
  ];

  function key(code) { return String(code).replace(/\s+/g, "").toLowerCase(); }

  var category = "winter";
  if (document.getElementById("add-" + category)) {
    var courses = data[category] || [];
    var placed = {};
    var n = 0;

    SEMESTERS.forEach(function (sem) {
      window.addSemesterHeading(category, sem.heading);
      sem.codes.forEach(function (code) {
        var course = courses.filter(function (c) { return key(c.code) === key(code); })[0];
        if (!course) return;
        placed[key(course.code)] = true;
        n += 1;
        window.addCourseTile(category, course, category + "-" + n);
      });
    });

    // Any course in data.js that isn't in the lists above still shows up, at the end
    courses.forEach(function (course) {
      if (placed[key(course.code)]) return;
      n += 1;
      window.addCourseTile(category, course, category + "-" + n);
    });

    (window.USER_COURSES[category] || []).forEach(function (course, i) {
      window.addCourseTile(category, course, "mine-" + category + "-" + (i + 1), { removable: true });
    });
  }
})();


// Add-course popup: turns the typed code + name + assessments into a new tile.
(function () {
  "use strict";

  var counter = 0;

  // ----- assessment rows inside the popup -----
  function createRow(category) {
    var list = document.getElementById("assess-" + category);
    var row = document.createElement("div");
    row.className = "assess-row";

    function field(type, cls, placeholder, label) {
      var input = document.createElement("input");
      input.type = type;
      input.className = cls;
      if (placeholder) input.placeholder = placeholder;
      input.setAttribute("aria-label", label);
      if (type === "number") { input.min = "1"; input.max = "52"; input.step = "1"; }
      return input;
    }

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "assess-remove";
    remove.setAttribute("aria-label", "Remove assessment");
    remove.textContent = "\u00D7";
    remove.addEventListener("click", function () { row.remove(); });

    // Date range for this assessment (optional)
    var dates = document.createElement("div");
    dates.className = "a-dates";
    var sep = document.createElement("span");
    sep.className = "a-dates-sep";
    sep.setAttribute("aria-hidden", "true");
    sep.textContent = "to";
    dates.appendChild(field("date", "a-start", "", "Assessment start date"));
    dates.appendChild(sep);
    dates.appendChild(field("date", "a-end", "", "Assessment end date"));

    row.appendChild(field("text", "a-name", "Assessment (e.g. Quiz 1)", "Assessment name"));
    row.appendChild(field("number", "a-week", "Week", "Week number"));
    row.appendChild(remove);
    row.appendChild(dates);
    row.appendChild(field("text", "a-desc", "Description (optional)", "Assessment description"));
    list.appendChild(row);
    return row;
  }

  function resetRows(category) {
    document.getElementById("assess-" + category).textContent = "";
    createRow(category);
  }

  // Returns an array of workload entries, or null if a row is invalid.
  // Each entry matches the data.js shape: { week, date, item, description },
  // plus startDate / endDate (ISO) when a date range was entered.
  function collectAssessments(category) {
    var out = [];
    var rows = document.querySelectorAll("#assess-" + category + " .assess-row");
    for (var i = 0; i < rows.length; i++) {
      var nameI = rows[i].querySelector(".a-name");
      var weekI = rows[i].querySelector(".a-week");
      var startI = rows[i].querySelector(".a-start");
      var endI = rows[i].querySelector(".a-end");
      var descI = rows[i].querySelector(".a-desc");
      var item = nameI.value.trim();
      var desc = descI.value.trim();
      var start = startI.value;
      var end = endI.value;
      if (!item && !weekI.value && !desc && !start && !end) continue;   // empty row: ignore

      [nameI, weekI, startI, endI].forEach(function (f) { f.setCustomValidity(""); });
      var week = parseInt(weekI.value, 10);
      if (!item) { nameI.setCustomValidity("Enter the assessment name."); nameI.reportValidity(); return null; }
      if (!(week >= 1 && week <= 52)) { weekI.setCustomValidity("Enter a week from 1 to 52."); weekI.reportValidity(); return null; }
      if (start && !end) { endI.setCustomValidity("Enter an end date."); endI.reportValidity(); return null; }
      if (end && !start) { startI.setCustomValidity("Enter a start date."); startI.reportValidity(); return null; }
      if (start && end && end < start) {                                  // ISO strings sort correctly
        endI.setCustomValidity("The end date can't be before the start date.");
        endI.reportValidity();
        return null;
      }

      var entry = { week: week, date: "", item: item, description: desc };
      if (start && end) {
        entry.date = start === end
          ? window.formatDate(start)
          : window.formatDate(start) + " \u2013 " + window.formatDate(end);
        entry.startDate = start;
        entry.endDate = end;
      }
      out.push(entry);
    }
    return out;
  }

  ["winter"].forEach(function (c) {
    if (document.getElementById("assess-" + c)) resetRows(c);
  });

  document.querySelectorAll(".btn-add-assess").forEach(function (btn) {
    btn.addEventListener("click", function () {
      createRow(btn.dataset.category).querySelector(".a-name").focus();
    });
  });

  // Dynamic rows: clear validation as the student types; Enter adds the course
  document.addEventListener("input", function (e) {
    if (e.target.closest && e.target.closest(".assess-row")) {
      e.target.closest(".assess-row").querySelectorAll("input").forEach(function (f) { f.setCustomValidity(""); });
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.closest && e.target.closest(".assess-row")) {
      e.preventDefault();
      e.target.closest(".modal-box").querySelector(".modal-confirm").click();
    }
  });

  function addCourse(toggleId) {
    var category = toggleId.replace("add-", "");           // "winter" or "transition"
    var codeInput = document.getElementById("code-" + category);
    var nameInput = document.getElementById("name-" + category);
    var toggle = document.getElementById(toggleId);
    var grid = toggle.closest(".course-grid");

    var code = codeInput.value.trim();
    var name = nameInput.value.trim();

    // Validate: both fields required, no duplicate codes in this category
    codeInput.setCustomValidity("");
    nameInput.setCustomValidity("");

    if (!code) {
      codeInput.setCustomValidity("Enter a course code.");
      codeInput.reportValidity();
      return false;
    }
    if (!name) {
      nameInput.setCustomValidity("Enter a course name.");
      nameInput.reportValidity();
      return false;
    }
    var duplicate = Array.prototype.some.call(
      grid.querySelectorAll(".course-tile .code"),
      function (el) { return el.textContent.trim().toLowerCase() === code.toLowerCase(); }
    );
    if (duplicate) {
      codeInput.setCustomValidity(code + " is already in the list.");
      codeInput.reportValidity();
      return false;
    }

    var assessments = collectAssessments(category);
    if (assessments === null) return false;

    // Save to this user's own list (data.js / COURSE_DATA is left untouched)
    var course = { code: code, name: name, workload: assessments };
    (window.USER_COURSES[category] = window.USER_COURSES[category] || []).push(course);
    window.saveUserCourses();

    counter += 1;
    window.addCourseTile(category, course, "mine-" + category + "-new-" + counter,
      { checked: true, removable: true });

    codeInput.value = "";
    nameInput.value = "";
    return true;
  }

  // "Add course" button in the popup
  document.querySelectorAll(".modal-confirm").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      var ok = addCourse(btn.htmlFor);
      if (!ok) e.preventDefault();                 // keep the popup open on errors
    });
  });

  // Clear validation messages as the student types; Enter submits
  document.querySelectorAll(".modal-box input[type='text']").forEach(function (input) {
    input.addEventListener("input", function () { input.setCustomValidity(""); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        input.closest(".modal-box").querySelector(".modal-confirm").click();
      }
    });
  });

  // Reset the fields whenever a popup closes; Escape closes it
  document.querySelectorAll(".modal-toggle").forEach(function (toggle) {
    toggle.addEventListener("change", function () {
      var category = toggle.id.replace("add-", "");
      var code = document.getElementById("code-" + category);
      var name = document.getElementById("name-" + category);
      if (toggle.checked) {
        code.focus();
      } else {
        code.value = name.value = "";
        resetRows(category);
        code.setCustomValidity("");
        name.setCustomValidity("");
      }
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".modal-toggle:checked").forEach(function (t) { t.click(); });
  });
})();


// Calculate workload: swap the course picker for a week-by-week schedule.
(function () {
  "use strict";

  var selectionView = document.getElementById("selection-view");
  var workloadView = document.getElementById("workload-view");
  var results = document.getElementById("workload-results");
  var summary = document.getElementById("workload-summary");
  var evalResults = document.getElementById("evaluation-results");
  var evalToggle = document.getElementById("toggle-evaluation");
  var currentCourses = [];      // the courses selected when Calculate was pressed

  // "category|code" -> workload entries: shared courses from data.js plus this
  // user's own. Read at calculate time so newly added courses are included.
  function buildLookup() {
    var lookup = {};
    [window.COURSE_DATA || {}, window.USER_COURSES || {}].forEach(function (source) {
      Object.keys(source).forEach(function (category) {
        (source[category] || []).forEach(function (course) {
          lookup[category + "|" + course.code] = course.workload || [];
        });
      });
    });
    return lookup;
  }

  // "category|code" -> course object (for the name), shared courses plus this user's own
  function buildCourseMap() {
    var map = {};
    [window.COURSE_DATA || {}, window.USER_COURSES || {}].forEach(function (source) {
      Object.keys(source).forEach(function (category) {
        (source[category] || []).forEach(function (course) {
          map[category + "|" + course.code] = course;
        });
      });
    });
    return map;
  }

  function selectedCourses() {
    return Array.prototype.map.call(
      document.querySelectorAll('input[name="winter"]:checked'),
      function (el) { return { category: el.name, code: el.value }; }
    );
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function render(courses) {
    var lookup = buildLookup();
    var byWeek = {};      // week -> { order: [codes], items: { code: [entries] } }
    var missing = [];

    courses.forEach(function (c) {
      var code = c.code;
      var entries = lookup[c.category + "|" + code];
      if (!entries || !entries.length) { missing.push(code); return; }
      entries.forEach(function (entry) {
        var week = byWeek[entry.week] = byWeek[entry.week] || { order: [], items: {} };
        if (!week.items[code]) { week.items[code] = []; week.order.push(code); }
        week.items[code].push(entry);
      });
    });

    results.textContent = "";
    summary.textContent = "Workload for: " + courses.map(function (c) { return c.code; }).join(", ");

    Object.keys(byWeek)
      .map(Number)
      .sort(function (a, b) { return a - b; })
      .forEach(function (weekNum) {
        var week = byWeek[weekNum];
        var card = el("section", "week-card");
        card.appendChild(el("h3", "week", "Week " + weekNum));

        var list = el("ul", "week-list");
        week.order.forEach(function (code) {
          var li = el("li");
          li.appendChild(el("span", "wl-code", code + ":"));

          // One course can have several assignments in the same week
          var items = el("div", "wl-items");
          week.items[code].forEach(function (entry) {
            var details = el("details", "assignment");
            details.appendChild(el("summary", "", entry.item));
            // Only assessments with a date range entered by the student show one
            if (entry.startDate && entry.endDate) {
              details.appendChild(el("p", "assignment-date", entry.date));
            }
            details.appendChild(el("p", "assignment-desc",
              entry.description || "No description available yet."));
            items.appendChild(details);
          });
          li.appendChild(items);
          list.appendChild(li);
        });
        card.appendChild(list);
        results.appendChild(card);
      });

    if (missing.length) {
      results.appendChild(el("p", "workload-note",
        "No workload information is available yet for: " + missing.join(", ") + "."));
    }
  }

  // One card per selected course, with its evaluation breakdown from data.js
  function renderEvaluations(courses) {
    var evaluations = window.COURSE_EVALUATIONS || {};
    var courseMap = buildCourseMap();
    var missing = [];

    evalResults.textContent = "";

    courses.forEach(function (c) {
      var text = (evaluations[c.category] || {})[c.code];
      if (!text) { missing.push(c.code); return; }

      // The sheet text starts with an "Evaluation Breakdown:" line; the card title covers that
      text = text.replace(/^\s*Evaluation Breakdown:?\s*/i, "");

      var course = courseMap[c.category + "|" + c.code];
      var card = el("section", "week-card");
      var title = el("h3", "week", c.code);
      if (course && course.name) title.appendChild(el("span", "eval-course-name", " \u2013 " + course.name));
      card.appendChild(title);
      card.appendChild(el("p", "eval-text", text));
      evalResults.appendChild(card);
    });

    if (missing.length) {
      evalResults.appendChild(el("p", "workload-note",
        "No evaluation breakdown is available yet for: " + missing.join(", ") + "."));
    }
  }

  // Switch the page between the weekly schedule and the evaluation breakdowns
  function showEvaluation(on) {
    if (on) renderEvaluations(currentCourses);
    results.hidden = on;
    evalResults.hidden = !on;
    summary.textContent = (on ? "Course evaluation for: " : "Workload for: ") +
      currentCourses.map(function (c) { return c.code; }).join(", ");
    evalToggle.textContent = on ? "Show workload schedule" : "Show course evaluation";
    evalToggle.setAttribute("aria-pressed", on ? "true" : "false");
  }

  evalToggle.addEventListener("click", function () {
    showEvaluation(evalResults.hidden);
  });

  document.querySelector(".calculate").addEventListener("click", function () {
    var courses = selectedCourses();
    if (!courses.length) {
      alert("Please select at least one course first.");
      return;
    }
    currentCourses = courses;
    render(courses);
    showEvaluation(false);                 // always open on the workload schedule
    selectionView.hidden = true;
    workloadView.hidden = false;
    window.scrollTo(0, 0);
  });

  document.getElementById("edit-courses").addEventListener("click", function () {
    if (!window.confirm("Warning: are you sure you want to edit your courses?")) return;
    workloadView.hidden = true;
    selectionView.hidden = false;   // selections are kept
    window.scrollTo(0, 0);
  });
})();
