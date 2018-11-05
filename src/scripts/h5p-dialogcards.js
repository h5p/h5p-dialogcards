import CardManager from './h5p-dialogcards-cardmanager';

const $ = H5P.jQuery;
const JoubelUI = H5P.JoubelUI;

class Dialogcards extends H5P.EventDispatcher {
  /**
   * Initialize module.
   *
   * TODO: Check resize/placement issues when cards vary in content/text length
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

    this.contentId = this.id = id;

    // Var cardOrder stores order of cards to allow resuming of card set.
    // Var progress stores current card index.
    this.contentData = contentData || {};

    // Set default behavior.
    this.params = $.extend({
      title: '',
      description: "Sit in pairs and make up sentences where you include the expressions below.<br/>Example: I should have said yes, HOWEVER I kept my mouth shut.",
      next: "Next",
      prev: "Previous",
      retry: "Retry",
      answer: "Turn",
      progressText: "Card @card of @total",
      cardFrontLabel: "Card front",
      cardBackLabel: "Card back",
      tipButtonLabel: 'Show tip',
      audioNotSupported: 'Your browser does not support this audio',
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
        //randomAnswers: false, // This param is not used!
        scaleTextNotCard: false,
        randomCards: false
      }
    }, params);

    // TODO: Check which variables are not needed anymore
    this._current = -1;
    this._turned = [];
    this.$images = [];
    this.audios = [];

    this.cards = [];

    this.currentCardId = 0;
    this.round = 1;
    this.results = [];

    /**
     * Attach h5p inside the given container.
     *
     * @param {jQuery} $container Container.
     */
    this.attach = ($container) => {
      this.cardManager = new CardManager(this.params, this.id, {
        onCardTurned: this.handleCardTurned,
        onNextCard: this.nextCard
      });
      this.cardIds = this.cardManager.createSelection();

      const title = $('<div>' + this.params.title + '</div>').text().trim();

      this.$inner = $container
        .addClass('h5p-dialogcards')
        .append($((title ? '<div class="h5p-dialogcards-title"><div class="h5p-dialogcards-title-inner">' + this.params.title + '</div></div>' : '') +
        '<div class="h5p-dialogcards-description">' + this.params.description + '</div>'
        ));

      if (this.params.behaviour.scaleTextNotCard) {
        $container.addClass('h5p-text-scaling');
      }

      this.initCards(this.params.dialogs)
        .appendTo(this.$inner);

      this.$cardSideAnnouncer = $('<div>', {
        html: this.params.cardFrontLabel,
        'class': 'h5p-dialogcards-card-side-announcer',
        'aria-live': 'polite',
        'aria-hidden': 'true'
      }).appendTo(this.$inner);

      this.createFooter()
        .appendTo(this.$inner);

      this.updateNavigation();

      this.on('reset', function () {
        this.reset();
      });

      this.on('resize', this.resize);
      this.trigger('resize');
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

      if (this.params.mode === 'normal') {
        this.$prev = JoubelUI.createButton({
          'class': 'h5p-dialogcards-footer-button h5p-dialogcards-prev truncated',
          'title': this.params.prev
        }).click(() => {
          this.prevCard();
        }).appendTo($footer);

        this.$next = JoubelUI.createButton({
          'class': 'h5p-dialogcards-footer-button h5p-dialogcards-next truncated',
          'title': this.params.next
        }).click(() => {
          this.nextCard();
        }).appendTo($footer);

        this.$retry = JoubelUI.createButton({
          'class': 'h5p-dialogcards-footer-button h5p-dialogcards-retry h5p-dialogcards-disabled',
          'title': this.params.retry,
          'html': this.params.retry
        }).click(() => {
          this.trigger('reset');
        }).appendTo($footer);

        this.$progress = $('<div>', {
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
     * @param {object[]} cards Card parameters
     * @returns {*|jQuery|HTMLElement} Card wrapper set
     */
    this.initCards = (cards) => {
      const initLoad = 2;

      // Randomize cards order
      if (this.params.behaviour.randomCards) {
        cards = H5P.shuffleArray(cards);
      }

      this.$cardwrapperSet = $('<div>', {
        'class': 'h5p-dialogcards-cardwrap-set'
      });

      for (let i = 0; i < cards.length; i++) {
        // Load cards progressively
        if (i >= initLoad) {
          break;
        }

        const card = this.cardManager.getCard(this.cardIds[i]);

        this.cards.push(card);
        const $cardWrapper = card.getDOM();

        // Set current card
        if (i === this.currentCardId) {
          $cardWrapper.addClass('h5p-dialogcards-current');
          this.$current = $cardWrapper;
        }

        card.addTipToCard($cardWrapper.find('.h5p-dialogcards-card-content'), 'front', i);

        this.$cardwrapperSet.append($cardWrapper);
      }

      return this.$cardwrapperSet;
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
        if (this.currentCardId < this.cardIds.length - 1) {
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

        this.$progress.text(this.params.progressText.replace('@card', this.currentCardId + 1).replace('@total', this.cardIds.length));

        this.cards[this.currentCardId].resizeOverflowingText();
      }
      else {
        this.$round.text(this.params.round.replace('@round', this.round));
        this.$progress.text(this.params.cardsLeft.replace('@number', this.cardIds.length - this.currentCardId));
      }

      this.trigger('resize');
    };

    /**
     * Show summary screen.
     */
    this.showSummaryScreen = () => {
      // TODO: HFP-2342 Implementation of summary screen
      console.log(this.results);
    };

    /**
     * Show next card.
     *
     * @param {object} [result] Optional result of repetition mode.
     */
    this.nextCard = (result) => {
      this.results.push(result);

      // On final card
      if (this.currentCardId + 1 === this.cardIds.length) {
        if (this.params.mode === 'repetition') {
          this.$progress.text(this.params.cardsLeft.replace('@number', 0));
          this.cards[this.currentCardId].showSummaryButton(this.showSummaryScreen);
        }
        return;
      }

      let currentCard = this.cards[this.currentCardId];
      currentCard.stopAudio();
      currentCard.getDOM().removeClass('h5p-dialogcards-current').addClass('h5p-dialogcards-previous');

      this.currentCardId++;
      currentCard = this.cards[this.currentCardId];
      currentCard.getDOM().addClass('h5p-dialogcards-current');
      currentCard.setCardFocus();

      // Load next card
      if (this.currentCardId + 1 < this.cardIds.length) {
        const card = this.cardManager.getCard(this.cardIds[this.currentCardId + 1]);
        this.cards.push(card);
        const $cardWrapper = card.getDOM();
        $cardWrapper.appendTo(this.$cardwrapperSet);

        card.addTipToCard($cardWrapper.find('.h5p-dialogcards-card-content'), 'front', this.currentCardId + 1);
        this.resize();
      }

      this.updateNavigation();
    };

    /**
     * Show previous card.
     */
    this.prevCard = () => {
      if (this.currentCardId === 0) {
        return;
      }

      let currentCard = this.cards[this.currentCardId];
      currentCard.stopAudio();
      currentCard.getDOM().removeClass('h5p-dialogcards-current');

      this.currentCardId--;
      currentCard = this.cards[this.currentCardId];
      currentCard.getDOM().addClass('h5p-dialogcards-current').removeClass('h5p-dialogcards-previous');
      currentCard.setCardFocus();

      this.updateNavigation();
    };

    /**
     * Show all audio buttons
     */
    this.showAllAudio = () => {
      this.$cardwrapperSet.find('.h5p-audio-inner')
        .removeClass('hide');
    };

    /**
     * Reset the task so that the user can do it again.
     *
     * TODO: Needs to be changed when HFP-2342 is done.
     */
    this.reset = () => {
      const self = this;

      this.cards[this.currentCardId].stopAudio(this.$current.index());

      // Show first card
      this.cards[this.currentCardId].getDOM().removeClass('h5p-dialogcards-current');
      this.currentCardId = 0;
      this.cards[this.currentCardId].getDOM().addClass('h5p-dialogcards-current');
      this.updateNavigation();

      // Turn all cards to front
      this.cards.forEach((card, index) => {
        const $card = card.getDOM();
        $card.removeClass('h5p-dialogcards-previous');
        card.changeText($card, self.params.dialogs[$card.index()].text);
        const $cardContent = $card.find('.h5p-dialogcards-card-content');
        $cardContent.removeClass('h5p-dialogcards-turned');
        card.addTipToCard($cardContent, 'front', index);
      });

      this.$retry.addClass('h5p-dialogcards-disabled');
      this.showAllAudio();
      this.cards[this.currentCardId].resizeOverflowingText();
      this.cards[this.currentCardId].setCardFocus(this.$current);
    };

    /**
     * Update the dimensions of the task when resizing the task.
     */
    this.resize = () => {
      let maxHeight = 0;
      this.updateImageSize();
      if (!this.params.behaviour.scaleTextNotCard) {
        this.determineCardSizes();
      }

      // Reset card-wrapper-set height
      this.$cardwrapperSet.css('height', 'auto');

      //Find max required height for all cards
      this.$cardwrapperSet.children().each( function () {
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
        if (self.cardSizeDetermined.indexOf(i) !== -1) {
          return; // Already determined, no need to determine again.
        }
        self.cardSizeDetermined.push(i);

        // Here "this" references the jQuery object
        const $content = $('.h5p-dialogcards-card-content', this);
        const $text = $('.h5p-dialogcards-card-text-inner-content', $content);

        // Grab size with text
        const textHeight = $text[0].getBoundingClientRect().height;

        // Change to answer
        self.cards[self.currentCardId].changeText($content, self.params.dialogs[i].answer);

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
        self.cards[self.currentCardId].changeText($content, self.params.dialogs[i].text);
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
        const getContentHeight = function () {
          let contentHeight = 0;
          this.$inner.children().each(function () {
            // Here "this" references the jQuery object
            contentHeight += $(this).get(0).getBoundingClientRect().height +
            parseFloat($(this).css('margin-top')) + parseFloat($(this).css('margin-bottom'));
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
     * Get the content type title.
     *
     * @return {string} title.
     */
    this.getTitle = () => {
      return H5P.createTitle((this.contentData && this.contentData.metadata && this.contentData.metadata.title) ? this.contentData.metadata.title : 'Dialog Cards');
    };
  }
}

// Constants
Dialogcards.SCALEINTERVAL = 0.2;
Dialogcards.MAXSCALE = 16;
Dialogcards.MINSCALE = 4;

export default Dialogcards;
