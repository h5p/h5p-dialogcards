class SummaryScreen {
  /**
   * @constructor
   */
  constructor(params, callbacks, contentId) {
    this.params = params;
    this.callbacks = callbacks;
    this.contentId = contentId

    this.currentCallback = callbacks.nextRound;

    this.fields = [];

    this.tableRows = {
      right: {
        title: this.params.summaryCardsRight,
        symbol: 'check'
      },
      wrong: {
        title: this.params.summaryCardsWrong,
        symbol: 'times'
      },
      'not-shown': {
        title: this.params.summaryCardsNotShown
      }
    };

    this.overallTableRows = {
      'cards-completed': {
        title: this.params.summaryCardsCompleted,
        symbol: 'check'
      },
      'completed-rounds': {
        title: this.params.summaryCompletedRounds,
      }
    };

    this.container = document.createElement('div');
    this.container.classList.add('h5p-dialogcards-summary-screen');

    const message = document.createElement('div');
    message.classList.add('h5p-dialogcards-summary-message');

    this.fields['message'] = message;

    const buttonNextRound = H5P.JoubelUI.createButton({
      'class': 'h5p-dialogcards-buttonNextRound h5p-theme-secondary-cta',
      'title': this.params.nextRound.replace('@round', 2),
      'html': this.params.nextRound.replace('@round', 2)
    }).click(this.currentCallback).get(0);

    this.fields['button'] = buttonNextRound;

    // Button to start over including confirmation dialog
    const buttonStartOver = H5P.JoubelUI.createButton({
      'class': 'h5p-dialogcards-button-restart h5p-theme-secondary-cta',
      'title': this.params.startOver,
      'html': this.params.startOver
    }).get(0);

    const confirmationDialog = this.createConfirmationDialog({
      l10n: this.params.confirmStartingOver,
      instance: this
    }, () => {
      // Stop interference with confirm dialog animation and goto animation
      setTimeout(() => {
        this.callbacks.retry();
      }, 100);
    });

    /*
     * For some reason, using $.click to add the listener in the line above
     * leads to losing the listener when button reappears on next summary screen
     */
    buttonStartOver.addEventListener('click', (event) => {
      confirmationDialog.show(event.target.offsetTop);
    });

    this.fields['buttonStartOver'] = buttonStartOver;

    // Footer
    const footer = document.createElement('div');
    footer.classList.add('h5p-dialogcards-summary-footer');
    footer.appendChild(buttonStartOver);
    footer.appendChild(buttonNextRound);

    this.container.appendChild(message);
    this.container.appendChild(footer);

    this.hide();

    return this;
  }

  /**
   * Get DOM of summary screen.
   * @return {object} Summary screen DOM.
   */
  getDOM() {
    return this.container;
  }

  /**
   * Create the score element to send to the ResultScreen component
   * @param {string} [symbol] Which 
   * @param {number} score Which score the user got
   * @param {number} [maxScore] What the max score is
   */
  createScoreElement({symbol, score, maxScore}) {
    let element = '';

    if (symbol) {
      element += `<div class="h5p-dialogcards-summary-table-row-symbol h5p-dialogcards-${symbol}"></div>`
    }

    if (score !== undefined) {
      element += `<div>${score.toString()}`; 

      if (maxScore) {
        element +=  ` <span>/</span> ${maxScore}`;
      }

      element += '</div>';
    }

    return  element;
  }

  /**
   * Create the question array for the ResultScreen component based on user results
   * @param {object[]} results The list of scores
   * @param {string} results.field Which field to update
   * @param {number} results.score.value How the user did
   * @param {number} [results.score.max] What the max score is
   */
  createQuestions(results) {
    const questions = [];
    const overallQuestions = [];

    results.forEach((result) => {
      let field = result.field.split('h5p-dialogcards-round-cards-');
      let data = this.tableRows[field[1]];
      let overallGroup = false;

      if(!data) {
        data = this.overallTableRows[result.field.split('h5p-dialogcards-overall-')[1]];
        overallGroup = true;
      }

      const question = {
        title: data.title,
        points: this.createScoreElement({
          symbol: data.symbol,
          score: result.score.value,
          maxScore: result.score.max,
        }),
      };

      if (overallGroup) {
        overallQuestions.push(question);
      }
      else {
        questions.push(question);
      }
    });

    return [
      { questions: questions },
      {
        listHeaders: [ this.params.summaryOverallScore ],
        questions: overallQuestions,
      }
    ];
  }

  /**
   * Update fields.
   * @param {object} [args] Arguments.
   * @param {boolean} [args.done] If true, learner is done.
   * @param {number} [args.round] Round number.
   * @param {string} [args.message] Message text.
   * @param {object[]} [args.results] Results.
   * @param {string} [args.results.field] Field identifier.
   * @param {object} [args.results.score] Score for field.
   * @param {number} [args.results.score.value] Score value for field.
   * @param {number} [args.results.score.max] Score max value for field.
   */
  update({done = false, round = undefined, message = undefined, results = []} = {}) {
    // Remove the old one
    if (this.resultScreen) {
      this.resultScreen.remove();
    }

    this.resultScreen = H5P.Components.ResultScreen({
      header: this.params.summary,
      scoreHeader: this.params.round.replace('@round', round),
      questionGroups: this.createQuestions(results),
    });

    this.container.prepend(this.resultScreen);

    if (done === true) {
      this.fields['buttonStartOver'].classList.add('h5p-dialogcards-button-gone');

      if (this.params.behaviour.enableRetry) {
        this.fields['button'].classList.remove('h5p-dialogcards-button-next-round');
        this.fields['button'].classList.add('h5p-dialogcards-button-restart');
        this.fields['button'].innerHTML = this.params.retry;
        this.fields['button'].title = this.params.retry;
        this.currentCallback = this.callbacks.retry;
      }
      else {
        this.fields['button'].classList.add('h5p-dialogcards-button-gone');
      }
    }
    else {
      this.fields['buttonStartOver'].classList.remove('h5p-dialogcards-button-gone');

      this.fields['button'].classList.add('h5p-dialogcards-button-next-round');
      this.fields['button'].classList.add('h5p-theme-secondary-cta');
      this.fields['button'].classList.remove('h5p-dialogcards-button-restart');
      this.fields['button'].innerHTML = this.params.nextRound;
      this.fields['button'].title = this.params.nextRound;
      this.currentCallback = this.callbacks.nextRound;
    }
    H5P.jQuery(this.fields['button']).unbind('click').click(this.currentCallback);

    // this.fields['round'].innerHTML = this.params.round.replace('@round', round);

    if (!done && round !== undefined) {
      this.fields['button'].innerHTML = this.params.nextRound.replace('@round', round + 1);
      this.fields['button'].title = this.params.nextRound.replace('@round', round + 1);
    }

    if (done && message !== undefined && message !== '') {
      this.fields['message'].classList.remove('h5p-dialogcards-gone');
      this.fields['message'].innerHTML = message;
    }
    else {
      this.fields['message'].classList.add('h5p-dialogcards-gone');
    }
  }

  /**
   * Show DOM.
   */
  show() {
    this.container.classList.remove('h5p-dialogcards-gone');
    // iOS13 requires DOM to be visible to focus
    setTimeout(() => {
      this.fields['button'].focus();
    }, 0);
  }

  /**
   * Hide DOM.
   */
  hide() {
    this.container.classList.add('h5p-dialogcards-gone');
  }

  /**
   * Add confirmation dialog to button.
   * @param {object} options Dialog options.
   * @param {function} clicked Callback for confirmation button.
   * @return {H5P.ConfirmationDialog|undefined} Confirmation dialog.
   */
  createConfirmationDialog(options, clicked) {
    options = options || {};

    var confirmationDialog = new H5P.ConfirmationDialog({
      instance: options.instance,
      headerText: options.l10n.header,
      dialogText: options.l10n.body,
      cancelText: options.l10n.cancelLabel,
      confirmText: options.l10n.confirmLabel,
      theme: true
    });

    confirmationDialog.on('confirmed', () => {
      clicked();
    });

    confirmationDialog.appendTo(this.getContainer());

    return confirmationDialog;
  }

  /**
   * Find container to attach dialogs to.
   * @return {HTMLElement} Container to attach dialogs to.
   */
  getContainer() {
    const $content = H5P.jQuery('[data-content-id="' + this.contentId + '"].h5p-content');
    const $containerParents = $content.parents('.h5p-container');

    let $container;
    if ($containerParents.length !== 0) {
      // use parent highest up if any
      $container = $containerParents.last();
    }
    else if ($content.length !== 0) {
      $container = $content;
    }
    else {
      $container = H5P.jQuery(document.body);
    }

    return $container.get(0);
  }
}

export default SummaryScreen;
