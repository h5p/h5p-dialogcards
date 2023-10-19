class SummaryScreen {
  /**
   * @constructor
   */
  constructor(params, callbacks) {
    this.params = params;
    this.callbacks = callbacks;

    this.currentCallback = callbacks.nextRound;

    this.fields = [];

    this.container = document.createElement('div');
    this.container.classList.add('h5p-dialogcards-summary-screen');

    const containerRound = this.createContainerDOM(params.summary);
    this.fields['round'] = containerRound.getElementsByClassName('h5p-dialogcards-summary-subheader')[0];

    this.fields['h5p-dialogcards-round-cards-right'] = this.addTableRow(
      containerRound, {category: this.params.summaryCardsRight, symbol: 'h5p-dialogcards-check'});
    this.fields['h5p-dialogcards-round-cards-wrong'] = this.addTableRow(
      containerRound, {category: this.params.summaryCardsWrong, symbol: 'h5p-dialogcards-times'});
    this.fields['h5p-dialogcards-round-cards-not-shown'] = this.addTableRow(
      containerRound, {category: this.params.summaryCardsNotShown});

    const containerOverall = this.createContainerDOM(params.summaryOverallScore);
    this.fields['h5p-dialogcards-overall-cards-completed'] = this.addTableRow(
      containerOverall, {category: this.params.summaryCardsCompleted, symbol: 'h5p-dialogcards-check'});
    this.fields['h5p-dialogcards-overall-completed-rounds'] = this.addTableRow(
      containerOverall, {category: this.params.summaryCompletedRounds, symbol: ''});

    const message = document.createElement('div');
    message.classList.add('h5p-dialogcards-summary-message');

    this.fields['message'] = message;

    const buttonNextRound = H5P.JoubelUI.createButton({
      'class': 'h5p-dialogcards-buttonNextRound',
      'title': this.params.nextRound.replace('@round', 2),
      'html': this.params.nextRound.replace('@round', 2)
    }).click(this.currentCallback).get(0);

    this.fields['button'] = buttonNextRound;

    // Button to start over including confirmation dialog
    const buttonStartOver = H5P.JoubelUI.createButton({
      'class': 'h5p-dialogcards-button-restart',
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

    this.container.appendChild(containerRound);
    this.container.appendChild(containerOverall);
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
   * Create container DOM.
   * @param {string} headerText Header text.
   * @param {string} [subheaderText=''] Sub-Header text.
   * @return {object} Container DOM.
   */
  createContainerDOM(headerText, subheaderText = '') {
    const container = document.createElement('div');
    container.classList.add('h5p-dialogcards-summary-container');

    const header = document.createElement('div');
    header.classList.add('h5p-dialogcards-summary-header');
    header.innerHTML = headerText;
    container.appendChild(header);

    const subheader = document.createElement('div');
    subheader.classList.add('h5p-dialogcards-summary-subheader');
    subheader.innerHTML = subheaderText;
    container.appendChild(subheader);

    const table = document.createElement('table');
    table.classList.add('h5p-dialogcards-summary-table');
    container.appendChild(table);

    return container;
  }

  /**
   * Add row to a table.
   * @param {object} container Container to add table to.
   * @param {object} cols Columns.
   * @param {string} cols.category Category text.
   * @param {string} [cols.symbol=''] Symbol.
   * @param {object} [cols.score] Score value and maximum value.
   * @param {number|string} [cols.score.value=''] Value.
   * @param {number|string} [cols.score.max] Maximum value.
   * @return {object} Score field for updating later.
   */
  addTableRow(container, cols) {
    const table = container.getElementsByClassName('h5p-dialogcards-summary-table')[0];

    const row = document.createElement('tr');

    const category = document.createElement('td');
    category.classList.add('h5p-dialogcards-summary-table-row-category');
    category.innerHTML = cols.category;
    row.appendChild(category);

    const symbol = document.createElement('td');
    symbol.classList.add('h5p-dialogcards-summary-table-row-symbol');
    if (cols.symbol !== undefined && cols.symbol !== '') {
      symbol.classList.add(cols.symbol);
    }
    row.appendChild(symbol);

    const score = document.createElement('td');
    score.classList.add('h5p-dialogcards-summary-table-row-score');
    row.appendChild(score);

    table.appendChild(row);

    return score;
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
      this.fields['button'].classList.remove('h5p-dialogcards-button-restart');
      this.fields['button'].innerHTML = this.params.nextRound;
      this.fields['button'].title = this.params.nextRound;
      this.currentCallback = this.callbacks.nextRound;
    }
    H5P.jQuery(this.fields['button']).unbind('click').click(this.currentCallback);

    this.fields['round'].innerHTML = this.params.round.replace('@round', round);

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

    results.forEach(result => {
      let scoreHTML = (result.score.value !== undefined) ? result.score.value : '';
      if (result.score.max !== undefined) {
        scoreHTML = `${scoreHTML}&nbsp;<span class="h5p-dialogcards-summary-table-row-score-divider">/</span>&nbsp;${result.score.max}`;
      }
      this.fields[result.field].innerHTML = scoreHTML;
    });
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
      confirmText: options.l10n.confirmLabel
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
    const $content = H5P.jQuery('[data-content-id="' + self.contentId + '"].h5p-content');
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
