(() => {
  "use strict";

  const banks = window.QUIZ_BANKS || {};
  const $ = (id) => document.getElementById(id);

  const setupView = $("setupView");
  const quizView = $("quizView");
  const resultView = $("resultView");
  const sectionGrid = $("sectionGrid");
  const optionsEl = $("options");
  const feedbackEl = $("feedback");

  let selectedBankKey = "management";
  let selectedBank = banks[selectedBankKey];

  let activeQuestions = [];
  let current = 0;
  let answers = new Map();      // question id => original answer index
  let answerOrders = new Map(); // question id => displayed original indices
  let scored = new Set();       // question ids already counted
  let bookmarks = new Set();    // bookmark ids in current subject
  let correctCount = 0;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function shuffledCopy(array) {
    const copy = array.slice();

    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  }

  function getQuestionCount() {
    return selectedBank?.questions?.length || 0;
  }

  function getQuestionById(id) {
    return selectedBank.questions.find((question) => question.id === id);
  }

  function getDisplayOrder(question) {
    if (answerOrders.has(question.id)) {
      return answerOrders.get(question.id);
    }

    const order = question.options.map((_, index) => index);

    if ($("shuffleAnswers").checked) {
      answerOrders.set(question.id, shuffledCopy(order));
    } else {
      answerOrders.set(question.id, order);
    }

    return answerOrders.get(question.id);
  }

  function createSectionRanges(total) {
    const ranges = [];
    const size = total > 500 ? 150 : 100;

    let start = 1;
    let section = 1;

    while (start <= total) {
      const end = Math.min(start + size - 1, total);

      ranges.push({
        label: `Section ${section}`,
        start,
        end,
      });

      start = end + 1;
      section += 1;
    }

    return ranges;
  }

  function renderSectionButtons() {
    const total = getQuestionCount();
    sectionGrid.innerHTML = "";

    createSectionRanges(total).forEach((range) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "section-card";
      button.dataset.start = String(range.start);
      button.dataset.end = String(range.end);

      const strong = document.createElement("strong");
      strong.textContent = range.label;

      const span = document.createElement("span");
      span.textContent = `Q${range.start}–${range.end}`;

      button.append(strong, span);
      button.addEventListener("click", () => {
        selectRange(range.start, range.end);
      });

      sectionGrid.appendChild(button);
    });

    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.className = "section-card all";
    allButton.dataset.start = "1";
    allButton.dataset.end = String(total);

    const allStrong = document.createElement("strong");
    allStrong.textContent = "All questions";

    const allSpan = document.createElement("span");
    allSpan.textContent = `Q1–${total}`;

    allButton.append(allStrong, allSpan);
    allButton.addEventListener("click", () => {
      selectRange(1, total);
    });

    sectionGrid.appendChild(allButton);
  }

  function updateSelectedBankUI() {
    if (!selectedBank) return;

    const total = getQuestionCount();

    $("selectedBankTitle").textContent = selectedBank.title;
    $("selectedBankCount").textContent = `${total} questions`;

    $("fromInput").min = "1";
    $("fromInput").max = String(total);
    $("fromInput").value = "1";

    $("toInput").min = "1";
    $("toInput").max = String(total);
    $("toInput").value = String(Math.min(20, total));

    $("jumpInput").min = "1";
    $("jumpInput").max = String(total);

    document.querySelectorAll(".subject-card").forEach((card) => {
      card.classList.toggle("selected", card.dataset.bank === selectedBankKey);
    });

    renderSectionButtons();
  }

  function chooseBank(bankKey) {
    if (!banks[bankKey]) return;

    selectedBankKey = bankKey;
    selectedBank = banks[bankKey];

    bookmarks = new Set();
    updateSelectedBankUI();
  }

  function selectRange(start, end) {
    const total = getQuestionCount();

    start = clamp(Number(start) || 1, 1, total);
    end = clamp(Number(end) || start, start, total);

    let picked = selectedBank.questions.filter(
      (question) => question.id >= start && question.id <= end,
    );

    if ($("shuffleQuestions").checked) {
      picked = shuffledCopy(picked);
    }

    begin(picked, {
      resetAnswers: true,
      rangeLabel: `Q${start}–${end}`,
    });
  }

  function begin(list, options = {}) {
    if (!list.length) return;

    const {
      resetAnswers = true,
      rangeLabel = `${list.length} questions`,
    } = options;

    activeQuestions = list.slice();
    current = 0;

    if (resetAnswers) {
      answers = new Map();
      answerOrders = new Map();
      scored = new Set();
      correctCount = 0;
    } else {
      recalculateScore();
    }

    $("quizSubject").textContent = selectedBank.title;
    $("quizRange").textContent = rangeLabel;

    setupView.classList.add("hidden");
    resultView.classList.add("hidden");
    quizView.classList.remove("hidden");

    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function recalculateScore() {
    correctCount = 0;
    scored = new Set();

    activeQuestions.forEach((question) => {
      if (!answers.has(question.id)) return;

      scored.add(question.id);

      if (answers.get(question.id) === question.correctIndex) {
        correctCount += 1;
      }
    });
  }

  function render() {
    if (!activeQuestions.length) return;

    const question = activeQuestions[current];
    const selectedOriginalIndex = answers.get(question.id);
    const displayOrder = getDisplayOrder(question);

    $("questionNumber").textContent = `Q${question.id}`;
    $("questionText").textContent = question.question;
    $("progressText").textContent =
      `Question ${current + 1} of ${activeQuestions.length}`;
    $("scoreText").textContent =
      `Score ${correctCount} / ${scored.size}`;
    $("progressBar").style.width =
      `${((current + 1) / activeQuestions.length) * 100}%`;

    $("bookmarkBtn").textContent = bookmarks.has(question.id)
      ? "★ Bookmarked"
      : "☆ Bookmark";

    $("prevBtn").disabled = current === 0;
    $("nextBtn").textContent =
      current === activeQuestions.length - 1 ? "Finish" : "Next";

    renderQuestionImage(question);
    renderOptions(question, displayOrder, selectedOriginalIndex);
    renderFeedback(question, selectedOriginalIndex);
  }

  function renderQuestionImage(question) {
    const image = $("questionImage");

    if (question.image) {
      image.src = question.image;
      image.classList.remove("hidden");
    } else {
      image.removeAttribute("src");
      image.classList.add("hidden");
    }
  }

  function renderOptions(question, displayOrder, selectedOriginalIndex) {
    optionsEl.innerHTML = "";

    displayOrder.forEach((originalIndex, displayIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-btn";

      const letter = document.createElement("span");
      letter.className = "option-letter";
      letter.textContent = String.fromCharCode(65 + displayIndex);

      const text = document.createElement("span");
      text.className = "option-text";
      text.textContent = question.options[originalIndex];

      button.append(letter, text);

      button.addEventListener("click", () => {
        choose(originalIndex);
      });

      if (selectedOriginalIndex !== undefined) {
        button.disabled = true;

        if (originalIndex === question.correctIndex) {
          button.classList.add("correct");
        }

        if (
          originalIndex === selectedOriginalIndex &&
          selectedOriginalIndex !== question.correctIndex
        ) {
          button.classList.add("wrong");
        }
      }

      optionsEl.appendChild(button);
    });
  }

  function renderFeedback(question, selectedOriginalIndex) {
    if (selectedOriginalIndex === undefined) {
      feedbackEl.className = "feedback hidden";
      feedbackEl.textContent = "";
      return;
    }

    const isCorrect = selectedOriginalIndex === question.correctIndex;

    feedbackEl.className = `feedback ${isCorrect ? "good" : "bad"}`;
    feedbackEl.textContent = isCorrect
      ? "Correct."
      : `Incorrect. Correct answer: ${question.options[question.correctIndex]}`;
  }

  function choose(originalIndex) {
    const question = activeQuestions[current];

    if (answers.has(question.id)) return;

    answers.set(question.id, originalIndex);

    if (!scored.has(question.id)) {
      scored.add(question.id);

      if (originalIndex === question.correctIndex) {
        correctCount += 1;
      }
    }

    render();
  }

  function finish() {
    quizView.classList.add("hidden");
    resultView.classList.remove("hidden");

    const answered = activeQuestions.filter((question) =>
      answers.has(question.id),
    ).length;

    const wrong = activeQuestions.filter(
      (question) =>
        answers.has(question.id) &&
        answers.get(question.id) !== question.correctIndex,
    );

    const unanswered = activeQuestions.length - answered;
    const percent = answered
      ? Math.round((correctCount / answered) * 100)
      : 0;

    $("finalScore").textContent = `${correctCount} / ${answered}`;
    $("finalPercent").textContent = `${percent}% correct`;

    $("resultDetails").innerHTML = "";

    const details = [
      `Answered: ${answered}`,
      `Wrong: ${wrong.length}`,
      `Unanswered: ${unanswered}`,
    ];

    details.forEach((text) => {
      const span = document.createElement("span");
      span.textContent = text;
      $("resultDetails").appendChild(span);
    });

    $("retryWrongBtn").disabled = wrong.length === 0;
    $("retryWrongBtn").textContent = wrong.length
      ? `Retry ${wrong.length} wrong answers`
      : "No wrong answers";
  }

  function goNext() {
    if (current < activeQuestions.length - 1) {
      current += 1;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      finish();
    }
  }

  function goPrevious() {
    if (current > 0) {
      current -= 1;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function showSetup() {
    setupView.classList.remove("hidden");
    quizView.classList.add("hidden");
    resultView.classList.add("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll(".subject-card").forEach((card) => {
    card.addEventListener("click", () => {
      chooseBank(card.dataset.bank);
    });
  });

  $("startRangeBtn").addEventListener("click", () => {
    selectRange($("fromInput").value, $("toInput").value);
  });

  $("nextBtn").addEventListener("click", goNext);
  $("prevBtn").addEventListener("click", goPrevious);
  $("restartBtn").addEventListener("click", showSetup);
  $("changeSubjectBtn").addEventListener("click", showSetup);
  $("backHomeBtn").addEventListener("click", showSetup);

  $("bookmarkBtn").addEventListener("click", () => {
    const question = activeQuestions[current];

    if (bookmarks.has(question.id)) {
      bookmarks.delete(question.id);
    } else {
      bookmarks.add(question.id);
    }

    render();
  });

  $("retryWrongBtn").addEventListener("click", () => {
    const wrongQuestions = activeQuestions.filter(
      (question) =>
        answers.has(question.id) &&
        answers.get(question.id) !== question.correctIndex,
    );

    if (!wrongQuestions.length) return;

    answers = new Map();
    answerOrders = new Map();
    scored = new Set();
    correctCount = 0;

    begin(wrongQuestions, {
      resetAnswers: false,
      rangeLabel: `Retrying ${wrongQuestions.length} wrong questions`,
    });
  });

  $("reviewWrongBtn").addEventListener("click", () => {
    const wrongQuestions = activeQuestions.filter(
      (question) =>
        answers.has(question.id) &&
        answers.get(question.id) !== question.correctIndex,
    );

    if (!wrongQuestions.length) {
      window.alert("No wrong answered questions yet.");
      return;
    }

    begin(wrongQuestions, {
      resetAnswers: false,
      rangeLabel: `Reviewing ${wrongQuestions.length} wrong questions`,
    });
  });

  $("reviewBookmarksBtn").addEventListener("click", () => {
    const marked = selectedBank.questions.filter((question) =>
      bookmarks.has(question.id),
    );

    if (!marked.length) {
      window.alert("No bookmarked questions yet.");
      return;
    }

    begin(marked, {
      resetAnswers: false,
      rangeLabel: `${marked.length} bookmarked questions`,
    });
  });

  const jumpDialog = $("jumpDialog");

  $("jumpBtn").addEventListener("click", () => {
    const currentQuestion = activeQuestions[current];
    const availableIds = activeQuestions.map((question) => question.id);
    const minId = Math.min(...availableIds);
    const maxId = Math.max(...availableIds);

    $("jumpInput").value = String(currentQuestion?.id || minId);
    $("jumpInput").min = String(minId);
    $("jumpInput").max = String(maxId);
    $("jumpHelp").textContent =
      `Current practice set contains ${activeQuestions.length} questions.`;

    if (typeof jumpDialog.showModal === "function") {
      jumpDialog.showModal();
    }
  });

  $("confirmJumpBtn").addEventListener("click", (event) => {
    event.preventDefault();

    const target = Number($("jumpInput").value);
    const index = activeQuestions.findIndex(
      (question) => question.id === target,
    );

    if (index >= 0) {
      current = index;
      jumpDialog.close();
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.alert(
        "That question is not inside the current practice set.",
      );
    }
  });

  updateSelectedBankUI();
})();
