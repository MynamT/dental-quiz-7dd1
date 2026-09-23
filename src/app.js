(() => {
  "use strict";

  /* =========================================================
     BASIC SETUP
  ========================================================= */

  const $ = (id) =>
    document.getElementById(id);

  let banks =
    window.QUIZ_BANKS || {};

  let currentUserId =
    window.QUIZ_USER_ID ||
    null;

  const STORAGE_PREFIX =
    "dental_quiz_progress_v2";

  const setupView =
    $("setupView");

  const quizView =
    $("quizView");

  const resultView =
    $("resultView");

  const sectionGrid =
    $("sectionGrid");

  const optionsEl =
    $("options");

  const feedbackEl =
    $("feedback");

  let selectedBankKey =
    "management";

  let selectedBank =
    banks[selectedBankKey];

  let activeQuestions =
    [];

  let current = 0;

  let answers =
    new Map();

  let answerOrders =
    new Map();

  let scored =
    new Set();

  let bookmarks =
    new Set();

  let correctCount = 0;

  let currentView =
    "setup";

  let currentRangeLabel =
    "";

  /* =========================================================
     STORAGE KEY

     Progress is separated using Netlify Identity user ID.
  ========================================================= */

  function getStorageKey() {
    if (!currentUserId) {
      return null;
    }

    return `${STORAGE_PREFIX}:${currentUserId}`;
  }

  /* =========================================================
     HELPERS
  ========================================================= */

  function clamp(
    value,
    min,
    max,
  ) {
    return Math.min(
      max,
      Math.max(
        min,
        value,
      ),
    );
  }

  function shuffledCopy(
    array,
  ) {
    const copy =
      array.slice();

    for (
      let i =
        copy.length - 1;
      i > 0;
      i -= 1
    ) {
      const j =
        Math.floor(
          Math.random() *
            (i + 1),
        );

      [
        copy[i],
        copy[j],
      ] = [
        copy[j],
        copy[i],
      ];
    }

    return copy;
  }

  function getQuestionCount() {
    return (
      selectedBank
        ?.questions
        ?.length || 0
    );
  }

  function getQuestionById(
    id,
  ) {
    if (
      !selectedBank
        ?.questions
    ) {
      return null;
    }

    return selectedBank.questions.find(
      (question) =>
        String(
          question.id,
        ) ===
        String(id),
    );
  }

  /* =========================================================
     SAVE QUIZ PROGRESS
  ========================================================= */

  function saveState() {
    const storageKey =
      getStorageKey();

    if (!storageKey) {
      return;
    }

    try {
      const state = {
        version: 2,

        selectedBankKey,

        activeQuestionIds:
          activeQuestions.map(
            (question) =>
              question.id,
          ),

        current,

        answers:
          Array.from(
            answers.entries(),
          ),

        answerOrders:
          Array.from(
            answerOrders.entries(),
          ),

        scored:
          Array.from(
            scored,
          ),

        bookmarks:
          Array.from(
            bookmarks,
          ),

        correctCount,

        currentView,

        currentRangeLabel,

        shuffleQuestions:
          $(
            "shuffleQuestions",
          )?.checked ||
          false,

        shuffleAnswers:
          $(
            "shuffleAnswers",
          )?.checked ||
          false,

        fromInput:
          $(
            "fromInput",
          )?.value ||
          "1",

        toInput:
          $(
            "toInput",
          )?.value ||
          "20",

        savedAt:
          Date.now(),
      };

      localStorage.setItem(
        storageKey,

        JSON.stringify(
          state,
        ),
      );
    } catch (error) {
      console.warn(
        "Unable to save quiz progress:",
        error,
      );
    }
  }

  /* =========================================================
     LOAD QUIZ PROGRESS
  ========================================================= */

  function loadSavedState() {
    const storageKey =
      getStorageKey();

    if (!storageKey) {
      return false;
    }

    try {
      const raw =
        localStorage.getItem(
          storageKey,
        );

      if (!raw) {
        return false;
      }

      const state =
        JSON.parse(raw);

      if (
        !state ||
        !banks[
          state.selectedBankKey
        ]
      ) {
        return false;
      }

      /* SUBJECT */

      selectedBankKey =
        state.selectedBankKey;

      selectedBank =
        banks[
          selectedBankKey
        ];

      updateSelectedBankUI();

      /* SETTINGS */

      if (
        $("shuffleQuestions")
      ) {
        $(
          "shuffleQuestions",
        ).checked =
          Boolean(
            state.shuffleQuestions,
          );
      }

      if (
        $("shuffleAnswers")
      ) {
        $(
          "shuffleAnswers",
        ).checked =
          Boolean(
            state.shuffleAnswers,
          );
      }

      if (
        state.fromInput !==
          undefined &&
        $("fromInput")
      ) {
        $("fromInput").value =
          state.fromInput;
      }

      if (
        state.toInput !==
          undefined &&
        $("toInput")
      ) {
        $("toInput").value =
          state.toInput;
      }

      /* BOOKMARKS */

      bookmarks =
        new Set(
          Array.isArray(
            state.bookmarks,
          )
            ? state.bookmarks
            : [],
        );

      /* ACTIVE QUESTIONS */

      activeQuestions =
        [];

      if (
        Array.isArray(
          state.activeQuestionIds,
        )
      ) {
        activeQuestions =
          state.activeQuestionIds
            .map(
              (id) =>
                getQuestionById(
                  id,
                ),
            )
            .filter(Boolean);
      }

      /* ANSWERS */

      answers =
        new Map(
          Array.isArray(
            state.answers,
          )
            ? state.answers
            : [],
        );

      /* SHUFFLED ANSWER ORDER */

      answerOrders =
        new Map(
          Array.isArray(
            state.answerOrders,
          )
            ? state.answerOrders
            : [],
        );

      /* SCORED */

      scored =
        new Set(
          Array.isArray(
            state.scored,
          )
            ? state.scored
            : [],
        );

      correctCount =
        Number(
          state.correctCount,
        ) || 0;

      currentRangeLabel =
        state.currentRangeLabel ||
        "";

      /* CURRENT QUESTION */

      if (
        activeQuestions.length
      ) {
        current =
          clamp(
            Number(
              state.current,
            ) || 0,

            0,

            activeQuestions.length -
              1,
          );
      } else {
        current = 0;
      }

      /* RESTORE SCREEN */

      if (
        state.currentView ===
          "quiz" &&
        activeQuestions.length
      ) {
        showQuizView(
          false,
        );

        return true;
      }

      if (
        state.currentView ===
          "result" &&
        activeQuestions.length
      ) {
        showResult(
          false,
        );

        return true;
      }

      showSetup(false);

      return true;
    } catch (error) {
      console.warn(
        "Unable to restore quiz progress:",
        error,
      );

      return false;
    }
  }

  /* =========================================================
     RESET IN-MEMORY QUIZ STATE

     Does NOT erase saved progress.
  ========================================================= */

  function resetMemory() {
    banks =
      window.QUIZ_BANKS ||
      banks ||
      {};

    selectedBankKey =
      "management";

    selectedBank =
      banks[
        selectedBankKey
      ];

    activeQuestions =
      [];

    current = 0;

    answers =
      new Map();

    answerOrders =
      new Map();

    scored =
      new Set();

    bookmarks =
      new Set();

    correctCount = 0;

    currentView =
      "setup";

    currentRangeLabel =
      "";
  }

  /* =========================================================
     SWITCH USER

     Called from main.js after authentication.
  ========================================================= */

  function setUser(userId) {
    if (
      currentUserId ===
        userId &&
      userId
    ) {
      /*
        Same account.

        Do not reset their active quiz unnecessarily.
      */

      if (
        !activeQuestions.length
      ) {
        loadSavedState();
      }

      return;
    }

    /*
      Save the old user's progress before switching.
    */

    if (currentUserId) {
      saveState();
    }

    currentUserId =
      userId || null;

    banks =
      window.QUIZ_BANKS ||
      banks ||
      {};

    resetMemory();

    if (!currentUserId) {
      return;
    }

    updateSelectedBankUI();

    const restored =
      loadSavedState();

    if (!restored) {
      showSetup(false);
    }
  }

  /* =========================================================
     DISPLAY ORDER
  ========================================================= */

  function getDisplayOrder(
    question,
  ) {
    if (
      answerOrders.has(
        question.id,
      )
    ) {
      return answerOrders.get(
        question.id,
      );
    }

    const order =
      question.options.map(
        (_, index) =>
          index,
      );

    if (
      $("shuffleAnswers")
        .checked
    ) {
      answerOrders.set(
        question.id,

        shuffledCopy(
          order,
        ),
      );
    } else {
      answerOrders.set(
        question.id,
        order,
      );
    }

    saveState();

    return answerOrders.get(
      question.id,
    );
  }

  /* =========================================================
     SECTIONS
  ========================================================= */

  function createSectionRanges(
    total,
  ) {
    const ranges = [];

    const size =
      total > 500
        ? 150
        : 100;

    let start = 1;

    let section = 1;

    while (
      start <= total
    ) {
      const end =
        Math.min(
          start +
            size -
            1,

          total,
        );

      ranges.push({
        label:
          `Section ${section}`,

        start,

        end,
      });

      start =
        end + 1;

      section += 1;
    }

    return ranges;
  }

  /* =========================================================
     SECTION BUTTONS
  ========================================================= */

  function renderSectionButtons() {
    const total =
      getQuestionCount();

    sectionGrid.innerHTML =
      "";

    createSectionRanges(
      total,
    ).forEach(
      (range) => {
        const button =
          document.createElement(
            "button",
          );

        button.type =
          "button";

        button.className =
          "section-card";

        button.dataset.start =
          String(
            range.start,
          );

        button.dataset.end =
          String(
            range.end,
          );

        const strong =
          document.createElement(
            "strong",
          );

        strong.textContent =
          range.label;

        const span =
          document.createElement(
            "span",
          );

        span.textContent =
          `Q${range.start}–${range.end}`;

        button.append(
          strong,
          span,
        );

        button.addEventListener(
          "click",
          () => {
            selectRange(
              range.start,
              range.end,
            );
          },
        );

        sectionGrid.appendChild(
          button,
        );
      },
    );

    /* ALL QUESTIONS */

    const allButton =
      document.createElement(
        "button",
      );

    allButton.type =
      "button";

    allButton.className =
      "section-card all";

    allButton.dataset.start =
      "1";

    allButton.dataset.end =
      String(total);

    const allStrong =
      document.createElement(
        "strong",
      );

    allStrong.textContent =
      "All questions";

    const allSpan =
      document.createElement(
        "span",
      );

    allSpan.textContent =
      `Q1–${total}`;

    allButton.append(
      allStrong,
      allSpan,
    );

    allButton.addEventListener(
      "click",
      () => {
        selectRange(
          1,
          total,
        );
      },
    );

    sectionGrid.appendChild(
      allButton,
    );
  }

  /* =========================================================
     SUBJECT UI
  ========================================================= */

  function updateSelectedBankUI() {
    if (!selectedBank) {
      return;
    }

    const total =
      getQuestionCount();

    $("selectedBankTitle")
      .textContent =
      selectedBank.title;

    $("selectedBankCount")
      .textContent =
      `${total} questions`;

    $("fromInput").min =
      "1";

    $("fromInput").max =
      String(total);

    $("fromInput").value =
      "1";

    $("toInput").min =
      "1";

    $("toInput").max =
      String(total);

    $("toInput").value =
      String(
        Math.min(
          20,
          total,
        ),
      );

    $("jumpInput").min =
      "1";

    $("jumpInput").max =
      String(total);

    document
      .querySelectorAll(
        ".subject-card",
      )
      .forEach(
        (card) => {
          card.classList.toggle(
            "selected",

            card.dataset.bank ===
              selectedBankKey,
          );
        },
      );

    renderSectionButtons();
  }

  /* =========================================================
     CHOOSE SUBJECT
  ========================================================= */

  function chooseBank(
    bankKey,
  ) {
    if (
      !banks[bankKey]
    ) {
      return;
    }

    selectedBankKey =
      bankKey;

    selectedBank =
      banks[bankKey];

    bookmarks =
      new Set();

    updateSelectedBankUI();

    saveState();
  }

  /* =========================================================
     SELECT RANGE
  ========================================================= */

  function selectRange(
    start,
    end,
  ) {
    const total =
      getQuestionCount();

    start =
      clamp(
        Number(start) ||
          1,

        1,

        total,
      );

    end =
      clamp(
        Number(end) ||
          start,

        start,

        total,
      );

    let picked =
      selectedBank.questions.filter(
        (question) =>
          question.id >=
            start &&
          question.id <=
            end,
      );

    if (
      $("shuffleQuestions")
        .checked
    ) {
      picked =
        shuffledCopy(
          picked,
        );
    }

    begin(
      picked,
      {
        resetAnswers:
          true,

        rangeLabel:
          `Q${start}–${end}`,
      },
    );
  }

  /* =========================================================
     BEGIN QUIZ
  ========================================================= */

  function begin(
    list,
    options = {},
  ) {
    if (!list.length) {
      return;
    }

    const {
      resetAnswers =
        true,

      rangeLabel =
        `${list.length} questions`,
    } = options;

    activeQuestions =
      list.slice();

    current = 0;

    currentRangeLabel =
      rangeLabel;

    if (
      resetAnswers
    ) {
      answers =
        new Map();

      answerOrders =
        new Map();

      scored =
        new Set();

      correctCount = 0;
    } else {
      recalculateScore();
    }

    showQuizView();
  }

  /* =========================================================
     SCORE
  ========================================================= */

  function recalculateScore() {
    correctCount = 0;

    scored =
      new Set();

    activeQuestions.forEach(
      (question) => {
        if (
          !answers.has(
            question.id,
          )
        ) {
          return;
        }

        scored.add(
          question.id,
        );

        if (
          answers.get(
            question.id,
          ) ===
          question.correctIndex
        ) {
          correctCount +=
            1;
        }
      },
    );
  }

  /* =========================================================
     QUIZ VIEW
  ========================================================= */

  function showQuizView(
    shouldSave = true,
  ) {
    if (
      !activeQuestions.length
    ) {
      showSetup();

      return;
    }

    currentView =
      "quiz";

    $("quizSubject")
      .textContent =
      selectedBank.title;

    $("quizRange")
      .textContent =
      currentRangeLabel ||
      `${activeQuestions.length} questions`;

    setupView.classList.add(
      "hidden",
    );

    resultView.classList.add(
      "hidden",
    );

    quizView.classList.remove(
      "hidden",
    );

    render();

    if (shouldSave) {
      saveState();
    }

    window.scrollTo({
      top: 0,

      behavior:
        "smooth",
    });
  }

  /* =========================================================
     RENDER QUESTION
  ========================================================= */

  function render() {
    if (
      !activeQuestions.length
    ) {
      return;
    }

    current =
      clamp(
        current,

        0,

        activeQuestions.length -
          1,
      );

    const question =
      activeQuestions[
        current
      ];

    if (!question) {
      return;
    }

    const selectedOriginalIndex =
      answers.get(
        question.id,
      );

    const displayOrder =
      getDisplayOrder(
        question,
      );

    $("questionNumber")
      .textContent =
      `Q${question.id}`;

    $("questionText")
      .textContent =
      question.question;

    $("progressText")
      .textContent =
      `Question ${
        current + 1
      } of ${
        activeQuestions.length
      }`;

    $("scoreText")
      .textContent =
      `Score ${correctCount} / ${scored.size}`;

    $("progressBar")
      .style.width =
      `${
        ((current + 1) /
          activeQuestions.length) *
        100
      }%`;

    $("bookmarkBtn")
      .textContent =
      bookmarks.has(
        question.id,
      )
        ? "★ Bookmarked"
        : "☆ Bookmark";

    $("prevBtn").disabled =
      current === 0;

    $("nextBtn")
      .textContent =
      current ===
      activeQuestions.length -
        1
        ? "Finish"
        : "Next";

    renderQuestionImage(
      question,
    );

    renderOptions(
      question,
      displayOrder,
      selectedOriginalIndex,
    );

    renderFeedback(
      question,
      selectedOriginalIndex,
    );

    saveState();
  }

  /* =========================================================
     QUESTION IMAGE
  ========================================================= */

  function renderQuestionImage(
    question,
  ) {
    const image =
      $("questionImage");

    if (
      question.image
    ) {
      image.src =
        question.image;

      image.classList.remove(
        "hidden",
      );
    } else {
      image.removeAttribute(
        "src",
      );

      image.classList.add(
        "hidden",
      );
    }
  }

  /* =========================================================
     OPTIONS
  ========================================================= */

  function renderOptions(
    question,
    displayOrder,
    selectedOriginalIndex,
  ) {
    optionsEl.innerHTML =
      "";

    displayOrder.forEach(
      (
        originalIndex,
        displayIndex,
      ) => {
        const button =
          document.createElement(
            "button",
          );

        button.type =
          "button";

        button.className =
          "option-btn";

        const letter =
          document.createElement(
            "span",
          );

        letter.className =
          "option-letter";

        letter.textContent =
          String.fromCharCode(
            65 +
              displayIndex,
          );

        const text =
          document.createElement(
            "span",
          );

        text.className =
          "option-text";

        text.textContent =
          question.options[
            originalIndex
          ];

        button.append(
          letter,
          text,
        );

        button.addEventListener(
          "click",
          () => {
            choose(
              originalIndex,
            );
          },
        );

        if (
          selectedOriginalIndex !==
          undefined
        ) {
          button.disabled =
            true;

          if (
            originalIndex ===
            question.correctIndex
          ) {
            button.classList.add(
              "correct",
            );
          }

          if (
            originalIndex ===
              selectedOriginalIndex &&
            selectedOriginalIndex !==
              question.correctIndex
          ) {
            button.classList.add(
              "wrong",
            );
          }
        }

        optionsEl.appendChild(
          button,
        );
      },
    );
  }

  /* =========================================================
     FEEDBACK
  ========================================================= */

  function renderFeedback(
    question,
    selectedOriginalIndex,
  ) {
    if (
      selectedOriginalIndex ===
      undefined
    ) {
      feedbackEl.className =
        "feedback hidden";

      feedbackEl.textContent =
        "";

      return;
    }

    const isCorrect =
      selectedOriginalIndex ===
      question.correctIndex;

    feedbackEl.className =
      `feedback ${
        isCorrect
          ? "good"
          : "bad"
      }`;

    feedbackEl.textContent =
      isCorrect
        ? "Correct."
        : `Incorrect. Correct answer: ${
            question.options[
              question.correctIndex
            ]
          }`;
  }

  /* =========================================================
     CHOOSE ANSWER
  ========================================================= */

  function choose(
    originalIndex,
  ) {
    const question =
      activeQuestions[
        current
      ];

    if (!question) {
      return;
    }

    if (
      answers.has(
        question.id,
      )
    ) {
      return;
    }

    answers.set(
      question.id,

      originalIndex,
    );

    if (
      !scored.has(
        question.id,
      )
    ) {
      scored.add(
        question.id,
      );

      if (
        originalIndex ===
        question.correctIndex
      ) {
        correctCount +=
          1;
      }
    }

    saveState();

    render();
  }

  /* =========================================================
     RESULT
  ========================================================= */

  function showResult(
    shouldSave = true,
  ) {
    currentView =
      "result";

    quizView.classList.add(
      "hidden",
    );

    setupView.classList.add(
      "hidden",
    );

    resultView.classList.remove(
      "hidden",
    );

    const answered =
      activeQuestions.filter(
        (question) =>
          answers.has(
            question.id,
          ),
      ).length;

    const wrong =
      activeQuestions.filter(
        (question) =>
          answers.has(
            question.id,
          ) &&
          answers.get(
            question.id,
          ) !==
            question.correctIndex,
      );

    const unanswered =
      activeQuestions.length -
      answered;

    const percent =
      answered
        ? Math.round(
            (correctCount /
              answered) *
              100,
          )
        : 0;

    $("finalScore")
      .textContent =
      `${correctCount} / ${answered}`;

    $("finalPercent")
      .textContent =
      `${percent}% correct`;

    $("resultDetails")
      .innerHTML =
      "";

    [
      `Answered: ${answered}`,

      `Wrong: ${wrong.length}`,

      `Unanswered: ${unanswered}`,
    ].forEach(
      (text) => {
        const span =
          document.createElement(
            "span",
          );

        span.textContent =
          text;

        $("resultDetails")
          .appendChild(
            span,
          );
      },
    );

    $("retryWrongBtn")
      .disabled =
      wrong.length === 0;

    $("retryWrongBtn")
      .textContent =
      wrong.length
        ? `Retry ${wrong.length} wrong answers`
        : "No wrong answers";

    if (shouldSave) {
      saveState();
    }
  }

  function finish() {
    showResult();
  }

  /* =========================================================
     NEXT
  ========================================================= */

  function goNext() {
    if (
      current <
      activeQuestions.length -
        1
    ) {
      current += 1;

      render();

      window.scrollTo({
        top: 0,
        behavior:
          "smooth",
      });
    } else {
      finish();
    }
  }

  /* =========================================================
     PREVIOUS
  ========================================================= */

  function goPrevious() {
    if (
      current > 0
    ) {
      current -= 1;

      render();

      window.scrollTo({
        top: 0,
        behavior:
          "smooth",
      });
    }
  }

  /* =========================================================
     HOME
  ========================================================= */

  function showSetup(
    shouldSave = true,
  ) {
    currentView =
      "setup";

    setupView.classList.remove(
      "hidden",
    );

    quizView.classList.add(
      "hidden",
    );

    resultView.classList.add(
      "hidden",
    );

    if (shouldSave) {
      saveState();
    }

    window.scrollTo({
      top: 0,

      behavior:
        "smooth",
    });
  }

  /* =========================================================
     SUBJECT BUTTONS
  ========================================================= */

  document
    .querySelectorAll(
      ".subject-card",
    )
    .forEach(
      (card) => {
        card.addEventListener(
          "click",
          () => {
            chooseBank(
              card.dataset.bank,
            );
          },
        );
      },
    );

  /* =========================================================
     START RANGE
  ========================================================= */

  $("startRangeBtn")
    .addEventListener(
      "click",
      () => {
        selectRange(
          $("fromInput").value,
          $("toInput").value,
        );
      },
    );

  /* =========================================================
     NAVIGATION
  ========================================================= */

  $("nextBtn")
    .addEventListener(
      "click",
      goNext,
    );

  $("prevBtn")
    .addEventListener(
      "click",
      goPrevious,
    );

  $("restartBtn")
    .addEventListener(
      "click",
      showSetup,
    );

  $("changeSubjectBtn")
    .addEventListener(
      "click",
      showSetup,
    );

  $("backHomeBtn")
    .addEventListener(
      "click",
      showSetup,
    );

  /* =========================================================
     BOOKMARK
  ========================================================= */

  $("bookmarkBtn")
    .addEventListener(
      "click",
      () => {
        const question =
          activeQuestions[
            current
          ];

        if (!question) {
          return;
        }

        if (
          bookmarks.has(
            question.id,
          )
        ) {
          bookmarks.delete(
            question.id,
          );
        } else {
          bookmarks.add(
            question.id,
          );
        }

        saveState();

        render();
      },
    );

  /* =========================================================
     RETRY WRONG
  ========================================================= */

  $("retryWrongBtn")
    .addEventListener(
      "click",
      () => {
        const wrongQuestions =
          activeQuestions.filter(
            (question) =>
              answers.has(
                question.id,
              ) &&
              answers.get(
                question.id,
              ) !==
                question.correctIndex,
          );

        if (
          !wrongQuestions.length
        ) {
          return;
        }

        answers =
          new Map();

        answerOrders =
          new Map();

        scored =
          new Set();

        correctCount = 0;

        begin(
          wrongQuestions,
          {
            resetAnswers:
              false,

            rangeLabel:
              `Retrying ${wrongQuestions.length} wrong questions`,
          },
        );
      },
    );

  /* =========================================================
     REVIEW WRONG
  ========================================================= */

  $("reviewWrongBtn")
    .addEventListener(
      "click",
      () => {
        const wrongQuestions =
          activeQuestions.filter(
            (question) =>
              answers.has(
                question.id,
              ) &&
              answers.get(
                question.id,
              ) !==
                question.correctIndex,
          );

        if (
          !wrongQuestions.length
        ) {
          alert(
            "No wrong answered questions yet.",
          );

          return;
        }

        begin(
          wrongQuestions,
          {
            resetAnswers:
              false,

            rangeLabel:
              `Reviewing ${wrongQuestions.length} wrong questions`,
          },
        );
      },
    );

  /* =========================================================
     BOOKMARK REVIEW
  ========================================================= */

  $("reviewBookmarksBtn")
    .addEventListener(
      "click",
      () => {
        const marked =
          selectedBank.questions.filter(
            (question) =>
              bookmarks.has(
                question.id,
              ),
          );

        if (!marked.length) {
          alert(
            "No bookmarked questions yet.",
          );

          return;
        }

        begin(
          marked,
          {
            resetAnswers:
              false,

            rangeLabel:
              `${marked.length} bookmarked questions`,
          },
        );
      },
    );

  /* =========================================================
     JUMP
  ========================================================= */

  const jumpDialog =
    $("jumpDialog");

  $("jumpBtn")
    .addEventListener(
      "click",
      () => {
        if (
          !activeQuestions.length
        ) {
          return;
        }

        const question =
          activeQuestions[
            current
          ];

        const ids =
          activeQuestions.map(
            (question) =>
              Number(
                question.id,
              ),
          );

        const minId =
          Math.min(
            ...ids,
          );

        const maxId =
          Math.max(
            ...ids,
          );

        $("jumpInput").value =
          String(
            question?.id ||
              minId,
          );

        $("jumpInput").min =
          String(minId);

        $("jumpInput").max =
          String(maxId);

        $("jumpHelp")
          .textContent =
          `Current practice set contains ${activeQuestions.length} questions.`;

        if (
          typeof jumpDialog.showModal ===
          "function"
        ) {
          jumpDialog.showModal();
        }
      },
    );

  $("confirmJumpBtn")
    .addEventListener(
      "click",
      (event) => {
        event.preventDefault();

        const target =
          Number(
            $("jumpInput").value,
          );

        const index =
          activeQuestions.findIndex(
            (question) =>
              Number(
                question.id,
              ) ===
              target,
          );

        if (
          index >= 0
        ) {
          current =
            index;

          jumpDialog.close();

          render();

          window.scrollTo({
            top: 0,

            behavior:
              "smooth",
          });
        } else {
          alert(
            "That question is not inside the current practice set.",
          );
        }
      },
    );

  /* =========================================================
     PRACTICE SETTINGS
  ========================================================= */

  $("shuffleQuestions")
    ?.addEventListener(
      "change",
      saveState,
    );

  $("shuffleAnswers")
    ?.addEventListener(
      "change",
      saveState,
    );

  $("fromInput")
    ?.addEventListener(
      "change",
      saveState,
    );

  $("toInput")
    ?.addEventListener(
      "change",
      saveState,
    );

  /* =========================================================
     SAVE WHEN PAGE CLOSES
  ========================================================= */

  window.addEventListener(
    "pagehide",
    saveState,
  );

  window.addEventListener(
    "beforeunload",
    saveState,
  );

  /* =========================================================
     EXPOSE CONTROLLER TO MAIN.JS
  ========================================================= */

  window.DENTAL_QUIZ_APP =
    {
      setUser,

      save:
        saveState,
    };

  /* =========================================================
     INITIAL START
  ========================================================= */

  updateSelectedBankUI();

  /*
    main.js normally calls setUser().

    This fallback handles the first dynamic import.
  */

  if (currentUserId) {
    const restored =
      loadSavedState();

    if (!restored) {
      showSetup(
        false,
      );
    }
  } else {
    showSetup(
      false,
    );
  }
})();
