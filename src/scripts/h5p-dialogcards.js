import CardManager from './h5p-dialogcards-card-manager';
import SummaryScreen from './h5p-dialogcards-summary-screen';

const $ = H5P.jQuery;
const JoubelUI = H5P.JoubelUI;

class Dialogcards extends H5P.EventDispatcher {
  /**
   * Initialize module.
   *
   * @constructor
   *
   * @param {Object} params Parameters.
   * @param {Number} id Content id.
   * @param {Object} contentData Content data, e.g. for saveContentState
   * @returns {DialogCards} self
   */
  constructor(params, id, contentData) {
    super();
    this.idCounter = Dialogcards.idCounter++;
    this.contentId = this.id = id;
    this.previousState = contentData.previousState || {};

    // Var cardOrder stores order of cards to allow resuming of card set.
    // Var progress stores current card index.
    this.contentData = contentData || {};

    // Set default behavior.
    this.params = $.extend({
      title: '',
      mode: 'normal',
      description: '',
      next: "Next",
      prev: "Previous",
      retry: "Retry",
      answer: "Turn",
      correctAnswer: 'I got it right!',
      incorrectAnswer: 'I got it wrong',
      round: 'Round @round',
      cardsLeft: 'Cards left: @number',
      nextRound: 'Proceed to round @round',
      startOver: 'Start over',
      showSummary: 'Next',
      summary: 'Summary',
      summaryCardsRight: 'Cards you got right:',
      summaryCardsWrong: 'Cards you got wrong:',
      summaryCardsNotShown: 'Cards in pool not shown:',
      summaryOverallScore: 'Overall Score',
      summaryCardsCompleted: 'Cards you have completed learning:',
      summaryCompletedRounds: 'Completed rounds:',
      summaryAllDone: 'Well done! You have mastered all @cards cards by getting them correct @max times!',
      progressText: "Card @card of @total",
      cardFrontLabel: "Card front",
      cardBackLabel: "Card back",
      tipButtonLabel: 'Show tip',
      audioNotSupported: 'Your browser does not support this audio',
      confirmStartingOver: {
        header: 'Start over?',
        body: 'All progress will be lost. Are you sure you want to start over?',
        cancelLabel: 'Cancel',
        confirmLabel: 'Start over'
      },
      dialogs: [
        {
          text: 'Horse',
          answer: 'Hest'
        },
        {
          text: 'Cow',
          answer: 'Ku'
        }
      ],
      behaviour: {
        enableRetry: true,
        disableBackwardsNavigation: false,
        scaleTextNotCard: false,
        randomCards: false,
        maxProficiency: 5,
        quickProgression: false
      }
    }, params);

    this.cards = [];

    this.currentCardId = 0;
    this.round = 0; // 0 indicates that DOM needs to be set up
    this.results = this.previousState.results || [];

    /**
     * Attach h5p inside the given container.
     *
     * @param {jQuery} $container Container.
     */
    this.attach = ($container) => {
      this.$inner = $container.addClass('h5p-dialogcards');
      if (this.params.behaviour.scaleTextNotCard) {
        $container.addClass('h5p-text-scaling');
      }

      // Only pass what's necessary
      const managerParams = {
        mode: this.params.mode,
        dialogs: this.params.dialogs,
        audioNotSupported: this.params.audioNotSupported,
        answer: this.params.answer,
        showSummary: this.params.showSummary,
        incorrectAnswer: this.params.incorrectAnswer,
        correctAnswer: this.params.correctAnswer,
        progressText: this.params.progressText,
        tipButtonLabel: this.params.tipButtonLabel,
        behaviour: {
          scaleTextNotCard: this.params.behaviour.scaleTextNotCard,
          maxProficiency: this.params.behaviour.maxProficiency,
          quickProgression: this.params.behaviour.quickProgression
        },
        cardPiles: this.previousState.cardPiles
      };

      this.cardManager = new CardManager(managerParams, this.id, {
        onCardTurned: this.handleCardTurned,
        onNextCard: this.nextCard
      }, this.idCounter);

      this.createDOM(this.round === 0);

      /*
       * Goto previously viewed card. It was possible to also recover the turned
       * state, but it feels sensible to let the previously viewed card be
       * reviewed starting with the front.
       */
      if (this.previousState.currentCardId !== undefined) {
        this.gotoCard(this.previousState.currentCardId);

        // Show summary if previous round was completed but next round not started.
        if (this.params.mode === 'repetition' && this.results.length === this.cardIds.length) {
          this.showSummary(true);
        }
      }

      this.updateNavigation();
      this.trigger('resize');
    };

    /**
     * Create DOM.
     * @param {boolean} firstCall Is first call?
     */
    this.createDOM = (firstCall) => {
      this.cardIds = (firstCall && this.previousState.cardIds) ?
        this.previousState.cardIds :
        this.cardManager.createSelection();

      this.cardPoolSize = this.cardPoolSize || this.cardManager.getSize();

      if (firstCall === true) {
        const title = $('<div>' + this.params.title + '</div>').text().trim();
        this.$header = $((title ? '<div class="h5p-dialogcards-title"><div class="h5p-dialogcards-title-inner">' + this.params.title + '</div></div>' : '') +
          '<div class="h5p-dialogcards-description">' + this.params.description + '</div>');

        this.summaryScreen = new SummaryScreen(this.params, {nextRound: this.nextRound, retry: this.restartRepetition});
      }

      if (firstCall === true) {
        this.$cardwrapperSet = this.initCards(this.cardIds);
      }
      else {
        this.$cardwrapperSet.detach();
        this.$cardwrapperSet = this.initCards(this.cardIds);
        this.$cardSideAnnouncer.before(this.$cardwrapperSet);
      }

      this.$cardwrapperSet.prepend(this.summaryScreen.getDOM());

      if (firstCall === true) {
        this.$cardSideAnnouncer = $('<div>', {
          html: this.params.cardFrontLabel,
          'class': 'h5p-dialogcards-card-side-announcer',
          'aria-live': 'polite'
        });

        this.$footer = this.createFooter();

        this.$mainContent = $('<div>')
          .append(this.$header)
          .append(this.$cardwrapperSet)
          .append(this.$cardSideAnnouncer)
          .append(this.$footer)
          .appendTo(this.$inner);

        this.on('reset', function () {
          this.reset();
        });

        this.on('resize', this.resize);

        // Set round to previous state if available
        this.round = (this.previousState.round !== undefined) ? this.previousState.round : 1;
      }
    };

    /**
     * Create footer/navigation line
     *
     * @returns {*|jQuery|HTMLElement} Footer element
     */
    this.createFooter = () => {
      const $footer = $('<nav>', {
        'class': 'h5p-dialogcards-footer',
        'role': 'navigation'
      });

      const mouseEnter = function ($element, text) {
        $($element).append('<span class="button-tooltip">' + text + '</span>');
        $($element).find('.button-tooltip').hide().fadeIn('fast');
      };

      const mouseLeave = function ($element) {
        $($element).find('.button-tooltip').remove();
      };

      if (this.params.mode === 'normal') {
        const self = this;
        this.$prev = JoubelUI.createButton({
          'class': 'h5p-dialogcards-footer-button h5p-dialogcards-prev truncated',
          'aria-label': this.params.prev,
        }).click(() => {
          this.prevCard();
        }).appendTo($footer);
        this.$prev.hover(function (event) {mouseEnter(self.$prev, self.params.prev)}, function () {mouseLeave(self.$prev)});

        this.$next = JoubelUI.createButton({
          'class': 'h5p-dialogcards-footer-button h5p-dialogcards-next truncated',
          'aria-label': this.params.next,
        }).click(() => {
          this.nextCard();
        }).appendTo($footer);
        this.$next.hover(function (event) {mouseEnter(self.$next, self.params.next)}, function () {mouseLeave(self.$next)});

        this.$retry = JoubelUI.createButton({
          'class': 'h5p-dialogcards-footer-button h5p-dialogcards-retry h5p-dialogcards-disabled',
          'html': this.params.retry,
        }).click(() => {
          this.trigger('reset');
        }).appendTo($footer);
        this.$retry.hover(function (event) {mouseEnter(self.$retry, self.params.retry)}, function () {mouseLeave(self.$retry)});

        this.$progress = $('<div>', {
          'id': 'h5p-dialogcards-progress-' + this.idCounter,
          'class': 'h5p-dialogcards-progress',
          'aria-live': 'assertive'
        }).appendTo($footer);
      }
      else {
        this.$round = $('<div>', {
          'class': 'h5p-dialogcards-round'
        }).appendTo($footer);

        this.$progress = $('<div>', {
          'class': 'h5p-dialogcards-cards-left',
          'aria-live': 'assertive'
        }).appendTo($footer);
      }

      return $footer;
    };

    /**
     * Called when all cards has been loaded.
     */
    this.updateImageSize = () => {
      // Find highest card content
      let relativeHeightCap = 15;
      let height = 0;

      const $currentCardContent = this.cards[this.currentCardId].getDOM().find('.h5p-dialogcards-card-content');

      this.params.dialogs.forEach(dialog => {
        if (!dialog.image) {
          return;
        }

        const imageHeight = dialog.image.height / dialog.image.width * $currentCardContent.get(0).getBoundingClientRect().width;
        if (imageHeight > height) {
          height = imageHeight;
        }
      });

      if (height > 0) {
        let relativeImageHeight = height / parseFloat(this.$inner.css('font-size'));
        if (relativeImageHeight > relativeHeightCap) {
          relativeImageHeight = relativeHeightCap;
        }
        this.cards.forEach(card => {
          card.getImage().parent().css('height', relativeImageHeight + 'em');
        });
      }
    };

    /**
     * Creates all cards and appends them to card wrapper.
     *
     * @param {object[]} cardIds Card ids.
     * @returns {*|jQuery|HTMLElement} Card wrapper set
     */
    this.initCards = (cardIds) => {
      const initLoad = 2;
      this.cards = [];
      this.currentCardId = 0;

      // Randomize cards order
      if (this.params.behaviour.randomCards) {
        cardIds = H5P.shuffleArray(cardIds);
      }

      const $cardwrapperSet = $('<div>', {
        'class': 'h5p-dialogcards-cardwrap-set'
      });

      for (let i = 0; i < cardIds.length; i++) {
        // Load cards progressively
        if (i >= initLoad) {
          break;
        }

        const card = this.getCard(cardIds[i]);
        card.setProgressText(i + 1, cardIds.length);

        this.cards.push(card);
        const $cardWrapper = card.getDOM();

        // Set current card
        if (i === this.currentCardId) {
          $cardWrapper.addClass('h5p-dialogcards-current');
          this.$current = $cardWrapper;
        }

        card.addTipToCard($cardWrapper.find('.h5p-dialogcards-card-content'), 'front', i);

        $cardwrapperSet.append($cardWrapper);
      }

      return $cardwrapperSet;
    };

    /**
     * Handle card turned.
     *
     * @param {boolean} turned - True, if card is turned.
     */
    this.handleCardTurned = (turned) => {
      // a11y notification
      this.$cardSideAnnouncer.html(turned ? this.params.cardFrontLabel : this.params.cardBackLabel);

      // retry button
      if (this.params.behaviour.enableRetry && this.currentCardId + 1 === this.cardIds.length) {
        if (this.$retry) {
          this.$retry.removeClass('h5p-dialogcards-disabled');
          this.truncateRetryButton();
        }
      }
    };

    /**
     * Update navigation text and show or hide buttons.
     */
    this.updateNavigation = () => {
      if (this.params.mode === 'normal') {
        // Final card
        if (this.getCurrentSelectionIndex() < this.cardIds.length - 1) {
          this.$next.removeClass('h5p-dialogcards-disabled');
          this.$retry.addClass('h5p-dialogcards-disabled');
        }
        else {
          this.$next.addClass('h5p-dialogcards-disabled');
        }

        // First card
        if (this.currentCardId > 0 && !this.params.behaviour.disableBackwardsNavigation) {
          this.$prev.removeClass('h5p-dialogcards-disabled');
        }
        else {
          this.$prev.addClass('h5p-dialogcards-disabled');
        }

        this.$progress.text(this.params.progressText
          .replace('@card', this.getCurrentSelectionIndex() + 1)
          .replace('@total', this.cardIds.length)
        );

        // Looks strange, but the Ids get mixed up elsewhere
        this.cards[this.findCardPosition(this.cards[this.currentCardId].id)].resizeOverflowingText();
      }
      else {
        this.$round.text(this.params.round.replace('@round', this.round));
        const selectionIndex = this.getCurrentSelectionIndex();
        this.$progress.text(this.params.cardsLeft.replace('@number', this.cardIds.length - selectionIndex));
      }

      this.trigger('resize');
    };

    /**
     * Show summary screen.
     * @param {boolean} [previousState = false] If true, piles will not be updated.
     */
    this.showSummary = (previousState = false) => {
      // Update piles and retrieve the new pile sizes
      const newPileSizes = (previousState) ?
        this.cardManager.getPileSizes() :
        this.cardManager.updatePiles(this.results);

      const right = this.results.filter(result => result.result === true).length;
      const wrong = this.results.length - right;
      const notShown = this.cardPoolSize - right - wrong;
      const completed = newPileSizes.slice(-1)[0];
      const done = completed === this.cardPoolSize;

      const summary = {
        round: this.round,
        results: [
          {
            field: 'h5p-dialogcards-round-cards-right',
            score: {value: right, max: wrong + right}
          },
          {
            field: 'h5p-dialogcards-round-cards-wrong',
            score: {value: wrong, max: wrong + right}
          },
          {
            field: 'h5p-dialogcards-round-cards-not-shown',
            score: {value: notShown}
          },
          {
            field: 'h5p-dialogcards-overall-cards-completed',
            score: {value: completed, max: this.cardPoolSize}
          },
          {
            field: 'h5p-dialogcards-overall-completed-rounds',
            score: {value: this.round}
          }
        ]
      };

      if (done) {
        summary.done = true;
        summary.message = this.params.summaryAllDone
          .replace('@cards', this.cardPoolSize)
          .replace('@max', this.params.behaviour.maxProficiency);
      }

      this.summaryScreen.update(summary);
      this.summaryScreen.show();
      this.hideCards();

      this.trigger('resize');
    };

    /**
     * Show main content.
     */
    this.showCards = () => {
      this.$cardwrapperSet.find('.h5p-dialogcards-cardwrap').removeClass('h5p-dialogcards-gone');
      this.$footer.removeClass('h5p-dialogcards-gone');
      this.cardsShown = true;
    };

    /**
     * Hide main content.
     */
    this.hideCards = () => {
      this.$cardwrapperSet.find('.h5p-dialogcards-cardwrap').addClass('h5p-dialogcards-gone');
      this.$footer.addClass('h5p-dialogcards-gone');
      this.cardsShown = false;
    };

    /**
     * Show next card.
     *
     * @param {object} [result] Optional result of repetition mode.
     */
    this.nextCard = (result) => {
      if (typeof(result) !== 'undefined') {
        this.results.push(result);
      }

      this.cards[this.currentCardId].stopAudio();

      // On final card
      if (this.cardIds.length - this.getCurrentSelectionIndex() === 1) {
        if (this.params.mode === 'repetition') {
          this.$progress.text(this.params.cardsLeft.replace('@number', 0));
          this.cards[this.currentCardId].showSummaryButton(this.showSummary);
        }
        return;
      }

      this.gotoCard(this.getCurrentSelectionIndex() + 1);
    };

    /**
     * Get card from card manager.
     * @param {number} id Card's Id.
     * @return {object} Card.
     */
    this.getCard = (id) => {
      const card = this.cardManager.getCard(id);
      card.createButtonListeners();

      return card;
    };

    /**
     * Find the position of a loaded card.
     * @param {number} cardId CardId to look for.
     * @return {number} Position or undefined.
     */
    this.findCardPosition = (cardId) => {
      let position;

      this.cards.forEach((card, index) => {
        if (!position && card.id === cardId) {
          position = index;
        }
      });

      return position;
    };

    /**
     * Insert a card into the DOM.
     * @param {Card} card Card to insert.
     * @param {number} [index] Position to insert card at.
     */
    this.insertCardToDOM = (card, index) => {
      const $node = card.getDOM();

      // Put at appropriate position.
      if (index === undefined) {
        $node.appendTo(this.$cardwrapperSet);
      }
      else if (index === 0) {
        this.$cardwrapperSet.prepend($node);
      }
      else {
        this.$cardwrapperSet.children().eq(index).after($node);
      }

      // Add hints
      card.addTipToCard($node.find('.h5p-dialogcards-card-content'), 'front', index);
    };

    /**
     * Go to a specific card in the selection. Cards may need to be loaded.
     * @param {number} targetPosition Target card position.
     */
    this.gotoCard = (targetPosition) => {
      if (targetPosition < 0 || targetPosition >= this.cardIds.length) {
        return;
      }

      // Stop action on current card
      const currentCard = this.cards[this.currentCardId];
      currentCard.stopAudio();
      currentCard.getDOM().removeClass('h5p-dialogcards-current');

      // Get card positions to check for being loaded
      const checkLoaded = [];
      if (targetPosition > 0) {
        checkLoaded.push(targetPosition - 1);
      }
      checkLoaded.push(targetPosition);
      if (targetPosition + 1 < this.cardIds.length) {
        checkLoaded.push(targetPosition + 1);
      }

      // Load and insert target card, predecessor and successor if required.
      checkLoaded.forEach(position => {
        const loadedPosition = this.findCardPosition(this.cardIds[position]);
        if (loadedPosition === undefined) {

          // Card has not been loaded. Load now.
          const card = this.getCard(this.cardIds[position]);
          card.setProgressText(position + 1, this.cardIds.length);

          /*
           * Try to find successor card in loaded pile and insert before
           * or put to the end of the loaded pile.
           */
          const successorId = Math.min(position + 1, this.cardIds.length - 1);
          const successor = this.findCardPosition(this.cardIds[successorId]);
          const insertPosition = successor || this.cards.length;

          this.cards.splice(insertPosition, 0, card);
          this.insertCardToDOM(card, insertPosition);
        }
      });

      this.resize();

      // Retrieve position of id now in *loaded cards*
      targetPosition = this.findCardPosition(this.cardIds[targetPosition]);

      // Set classes for card order/display
      this.cards.forEach((card, index) => {
        if (index < targetPosition) {
          card.getDOM().addClass('h5p-dialogcards-previous');
        }
        else {
          card.getDOM().removeClass('h5p-dialogcards-previous');

          if (index === targetPosition) {
            card.getDOM().addClass('h5p-dialogcards-current');
          }
        }
      });

      this.currentCardId = targetPosition;
      this.updateNavigation();
      this.cards[this.currentCardId].setCardFocus();
    };

    /**
     * Show previous card.
     */
    this.prevCard = () => {
      this.gotoCard(this.getCurrentSelectionIndex() - 1);
    };

    /**
     * Show all audio buttons
     */
    this.showAllAudio = () => {
      this.$cardwrapperSet.find('.h5p-audio-inner')
        .removeClass('hide');
    };

    this.restartRepetition = () => {
      this.cardManager.reset();
      this.round = 0;

      this.nextRound();
    };

    /**
     * Start next round
     * @param {boolean} moveFocus True to set focus on card
     */
    this.nextRound = (moveFocus = true) => {
      this.round++;
      this.summaryScreen.hide();
      this.showCards();

      this.reset();
      this.createDOM();

      this.updateNavigation();
      if (this.isRoot() || moveFocus) {
        this.cards[this.currentCardId].setCardFocus(true);
      }

      this.trigger('resize');
    };

    /**
     * Reset the task so that the user can do it again.
     */
    this.reset = () => {
      this.results = [];
      this.cards[this.currentCardId].stopAudio(this.$current.index());

      // Turn all cards to front
      this.cards.forEach(card => {
        card.reset();
      });

      // Show first card
      this.currentCardId = 0;
      if (this.params.mode === 'normal') {
        this.cards[this.currentCardId].getDOM().addClass('h5p-dialogcards-current');
      }
      this.updateNavigation();

      if (this.$retry) {
        this.$retry.addClass('h5p-dialogcards-disabled');
      }
      this.showAllAudio();

      this.cards[this.currentCardId].resizeOverflowingText();
      this.cards[this.currentCardId].setCardFocus();
    };

    /**
     * Update the dimensions of the task when resizing the task.
     */
    this.resize = () => {
      let maxHeight = 0;
      this.updateImageSize();
      if (!this.params.behaviour.scaleTextNotCard && this.cardsShown !== false) {
        this.determineCardSizes();
      }

      // Reset card-wrapper-set height
      this.$cardwrapperSet.css('height', 'auto');

      //Find max required height for all cards
      this.$cardwrapperSet.children(':not(.h5p-dialogcards-gone)').each( function () {
        const wrapperHeight = $(this).css('height', 'initial').outerHeight();
        $(this).css('height', 'inherit');
        maxHeight = wrapperHeight > maxHeight ? wrapperHeight : maxHeight;

        // Check height
        if (!$(this).next('.h5p-dialogcards-cardwrap').length) {
          const initialHeight = $(this).find('.h5p-dialogcards-cardholder').css('height', 'initial').outerHeight();
          maxHeight = initialHeight > maxHeight ? initialHeight : maxHeight;
          $(this).find('.h5p-dialogcards-cardholder').css('height', 'inherit');
        }
      });
      const relativeMaxHeight = maxHeight / parseFloat(this.$cardwrapperSet.css('font-size'));
      this.$cardwrapperSet.css('height', relativeMaxHeight + 'em');
      this.scaleToFitHeight();
      this.truncateRetryButton();

      this.cards[this.currentCardId].resizeOverflowingText();
    };

    /**
     * Resizes each card to fit its text
     */
    this.determineCardSizes = () => {
      const self = this;

      if (this.cardSizeDetermined === undefined) {
        // Keep track of which cards we've already determined size for
        this.cardSizeDetermined = [];
      }

      // Go through each card
      this.$cardwrapperSet.children(':visible').each(function (i) {
        const cardId = self.cards[i].id;

        if (self.cardSizeDetermined.indexOf(cardId) !== -1) {
          return; // Already determined, no need to determine again.
        }
        self.cardSizeDetermined.push(cardId);

        // Here "this" references the jQuery object
        const $content = $('.h5p-dialogcards-card-content', this);
        const $text = $('.h5p-dialogcards-card-text-inner-content', $content);

        // Grab size with text
        const textHeight = $text[0].getBoundingClientRect().height;

        // Change to answer
        const currentCard = self.cards[i];
        currentCard.changeText(currentCard.getAnswer());

        // Grab size with answer
        const answerHeight = $text[0].getBoundingClientRect().height;

        // Use highest
        let useHeight = (textHeight > answerHeight ? textHeight : answerHeight);

        // Min. limit
        const minHeight = parseFloat($text.parent().parent().css('minHeight'));
        if (useHeight < minHeight) {
          useHeight =  minHeight;
        }

        // Convert to em
        const fontSize = parseFloat($content.css('fontSize'));
        useHeight /= fontSize;

        // Set height
        $text.parent().css('height', useHeight + 'em');

        // Change back to text
        currentCard.changeText(currentCard.getText());
      });
    };

    /**
     * Scales the card contents.
     */
    this.scaleToFitHeight = () => {
      if (!this.$cardwrapperSet || !this.$cardwrapperSet.is(':visible') || !this.params.behaviour.scaleTextNotCard) {
        return;
      }

      // Resize font size to fit inside CP
      if (this.$inner.parents('.h5p-course-presentation').length) {
        let $parentContainer = this.$inner.parent();
        if (this.$inner.parents('.h5p-popup-container').length) {
          $parentContainer = this.$inner.parents('.h5p-popup-container');
        }
        const containerHeight = $parentContainer.get(0).getBoundingClientRect().height;
        const getContentHeight = () => {
          let contentHeight = 0;
          this.$inner.children().each(function () {
            // Here "this" references the jQuery object
            const $child = $(this);
            contentHeight += this.getBoundingClientRect().height +
            parseFloat($child.css('margin-top')) + parseFloat($child.css('margin-bottom'));
          });
          return contentHeight;
        };
        let contentHeight = getContentHeight();
        const parentFontSize = parseFloat(this.$inner.parent().css('font-size'));
        let newFontSize = parseFloat(this.$inner.css('font-size'));

        // Decrease font size
        if (containerHeight < contentHeight) {
          while (containerHeight < contentHeight) {
            newFontSize -= Dialogcards.SCALEINTERVAL;

            // Cap at min font size
            if (newFontSize < Dialogcards.MINSCALE) {
              break;
            }

            // Set relative font size to scale with full screen.
            this.$inner.css('font-size', (newFontSize / parentFontSize) + 'em');
            contentHeight = getContentHeight();
          }
        }
        else { // Increase font size
          let increaseFontSize = true;
          while (increaseFontSize) {
            newFontSize += Dialogcards.SCALEINTERVAL;

            // Cap max font size
            if (newFontSize > Dialogcards.MAXSCALE) {
              increaseFontSize = false;
              break;
            }

            // Set relative font size to scale with full screen.
            let relativeFontSize = newFontSize / parentFontSize;
            this.$inner.css('font-size', relativeFontSize + 'em');
            contentHeight = getContentHeight();
            if (containerHeight <= contentHeight) {
              increaseFontSize = false;
              relativeFontSize = (newFontSize - Dialogcards.SCALEINTERVAL) / parentFontSize;
              this.$inner.css('font-size', relativeFontSize + 'em');
            }
          }
        }
      }
      else { // Resize mobile view
        this.cards[this.currentCardId].resizeOverflowingText();
      }
    };

    /**
     * Truncate retry button if width is small.
     */
    this.truncateRetryButton = () => {
      if (!this.$retry) {
        return;
      }

      // Reset button to full size
      this.$retry.removeClass('truncated');
      this.$retry.html(this.params.retry);

      // Measure button
      const maxWidthPercentages = 0.3;
      const retryWidth = this.$retry.get(0).getBoundingClientRect().width +
          parseFloat(this.$retry.css('margin-left')) + parseFloat(this.$retry.css('margin-right'));
      const retryWidthPercentage = retryWidth / this.$retry.parent().get(0).getBoundingClientRect().width;

      // Truncate button
      if (retryWidthPercentage > maxWidthPercentages) {
        this.$retry.addClass('truncated');
        this.$retry.html('');
      }
    };

    /**
     * Retrieve index of card in selection, not loaded cards.
     */
    this.getCurrentSelectionIndex = () => this.cardIds.indexOf(this.cards[this.currentCardId].id);

    /**
     * Get the content type title.
     *
     * @return {string} title.
     */
    this.getTitle = () => {
      return H5P.createTitle((this.contentData && this.contentData.metadata && this.contentData.metadata.title) ? this.contentData.metadata.title : 'Dialog Cards');
    };

    /**
     * Save the current state to be restored later.
     */
    this.getCurrentState = () => {
      // Not initialized
      if (!this.cardManager) {
        return;
      }

      return this.isProgressStarted()
        ? {
          cardPiles: this.cardManager.getPiles(),
          cardIds: this.cardIds,
          round: this.round,
          currentCardId: this.getCurrentSelectionIndex(),
          results: this.results
        }
        : undefined;
    };

    /**
     * Checks if progress on dialog cards has been started
     * Note - does not consider whether the first card has been turned or not
     * @returns {boolean} True if progress has been started, false otherwise.
     */
    this.isProgressStarted = () => {
      return !H5P.isEmpty(this.previousState)
          || this.getCurrentSelectionIndex() !== 0
          || this.results.length !== 0
          || this.round !== 1;
    }

    /**
     * Resets task to the initial state
     * @param {boolean} moveFocus True to move the focus
     * This prevents loss of focus if reset from within content
     */
    this.resetTask = (moveFocus = false) => {
      if (this.cardManager) { // Check if initialized
        this.previousState = {};
        this.round = 0;
        this.nextRound(moveFocus); // Also calls reset(), which takes care about resetting everything else
      }
    }
  }
}

Dialogcards.idCounter = 0;

// Constants
Dialogcards.SCALEINTERVAL = 0.2;
Dialogcards.MAXSCALE = 16;
Dialogcards.MINSCALE = 4;

export default Dialogcards;
