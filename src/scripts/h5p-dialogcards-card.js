const $ = H5P.jQuery;

class Card {
  /**
   * @constructor
   *
   * @param {object} card Card parameters
   * @param {object} params Parent's params // TODO: Only pass what's required
   * @param {number} id Card number in order of appearance
   * @param {object} [callbacks] Callbacks.
   * @param {function} [callbacks.onCardSize] Call when card needs resize.
   * @param {function} [callbacks.onCardTurned] Call when card was turned.
   */
  constructor(card, params, id, contentId, callbacks={}) {
    this.card = card;
    this.params = params || {};
    this.id = id;
    this.contentId = contentId;
    this.callbacks = callbacks;

    this.$cardWrapper = $('<div>', {'class': 'h5p-dialogcards-cardwrap'});

    const $cardHolder = $('<div>', {'class': 'h5p-dialogcards-cardholder'})
      .appendTo(this.$cardWrapper);

    // Progress for assistive technologies
    const progressText = params.progressText
      .replace('@card', (id + 1).toString())
      .replace('@total', (params.dialogs.length).toString());

    $('<div>', {
      'class': 'h5p-dialogcards-at-progress',
      'text': progressText
    }).appendTo($cardHolder);

    this.createCardContent(card)
      .appendTo($cardHolder);

    return this;
  }

  /**
   * Create content for a card
   *
   * @param {object} card Card parameters
   * @returns {*|jQuery|HTMLElement} Card content wrapper
   */
  createCardContent(card) {
    const $cardContent = $('<div>', {
      'class': 'h5p-dialogcards-card-content'
    });

    this.createCardImage(card)
      .appendTo($cardContent);

    const $cardTextWrapper = $('<div>', {
      'class': 'h5p-dialogcards-card-text-wrapper'
    }).appendTo($cardContent);

    const $cardTextInner = $('<div>', {
      'class': 'h5p-dialogcards-card-text-inner'
    }).appendTo($cardTextWrapper);

    const $cardTextInnerContent = $('<div>', {
      'class': 'h5p-dialogcards-card-text-inner-content'
    }).appendTo($cardTextInner);

    this.createCardAudio(card)
      .appendTo($cardTextInnerContent);

    const $cardText = $('<div>', {
      'class': 'h5p-dialogcards-card-text'
    }).appendTo($cardTextInnerContent);

    $('<div>', {
      'class': 'h5p-dialogcards-card-text-area',
      'tabindex': '-1',
      'html': card.text
    }).appendTo($cardText);

    if (!card.text || !card.text.length) {
      $cardText.addClass('hide');
    }

    this.createCardFooter()
      .appendTo($cardTextWrapper);

    return $cardContent;
  }

  /**
   * Create card image
   *
   * @param {object} card Card parameters
   * @returns {*|jQuery|HTMLElement} Card image wrapper
   */
  createCardImage(card) {
    this.$image;
    const $imageWrapper = $('<div>', {
      'class': 'h5p-dialogcards-image-wrapper'
    });

    if (card.image !== undefined) {
      this.image = card.image;
      this.$image = $('<img class="h5p-dialogcards-image" src="' + H5P.getPath(card.image.path, this.contentId) + '"/>');

      if (card.imageAltText) {
        this.$image.attr('alt', card.imageAltText);
      }
    }
    else {
      this.$image = $('<div class="h5p-dialogcards-image"></div>');
    }

    this.$image.appendTo($imageWrapper);

    return $imageWrapper;
  }

  /**
   * Create card audio.
   *
   * @param {object} card Card parameters.
   * @returns {*|jQuery|HTMLElement} Card audio element.
   */
  createCardAudio(card) {
    this.audio;

    this.$audioWrapper = $('<div>', {
      'class': 'h5p-dialogcards-audio-wrapper'
    });

    if (card.audio !== undefined) {
      const audioDefaults = {
        files: card.audio,
        audioNotSupported: this.params.audioNotSupported
      };

      this.audio = new H5P.Audio(audioDefaults, this.contentId);
      this.audio.attach(this.$audioWrapper);

      // Have to stop else audio will take up a socket pending forever in chrome.
      if (this.audio.audio && this.audio.audio.preload) {
        this.audio.audio.preload = 'none';
      }
    }
    else {
      this.$audioWrapper.addClass('hide');
    }
    // TODO: Here the audio was pushed to the parent. Change retrieval there!

    return this.$audioWrapper;
  }

  /**
   * Create card footer
   *
   * @returns {*|jQuery|HTMLElement} Card footer element
   */
  createCardFooter() {
    const $cardFooter = $('<div>', {
      'class': 'h5p-dialogcards-card-footer'
    });

    let classesRepetition = 'h5p-dialogcards-button-hidden';
    let attributeTabindex = '-1';

    if (this.params.mode === 'repetition') {
      classesRepetition = '';
      if (this.params.quickProgression) {
        classesRepetition = 'h5p-dialogcards-quick-progression';
        attributeTabindex = '0';
      }
    }

    H5P.JoubelUI.createButton({
      'class': 'h5p-dialogcards-answer-button',
      'html': this.params.incorrectAnswer
    }).click((event) => {
      if (!event.target.classList.contains('h5p-dialogcards-quick-progression')) {
        return;
      }
      this.callbacks.onNextCard({cardId: this.id, result: false});
    }).addClass('incorrect')
      .addClass(classesRepetition)
      .attr('tabindex', attributeTabindex)
      .appendTo($cardFooter);

    this.buttonTurn = H5P.JoubelUI.createButton({
      'class': 'h5p-dialogcards-turn',
      'html': this.params.answer
    }).click(() => {
      this.turnCard();
    }).appendTo($cardFooter);

    this.buttonShowSummary = H5P.JoubelUI.createButton({
      'class': 'h5p-dialogcards-show-summary h5p-dialogcards-button-gone',
      'html': this.params.showSummary
    }).appendTo($cardFooter);

    H5P.JoubelUI.createButton({
      'class': 'h5p-dialogcards-answer-button',
      'html': this.params.correctAnswer
    }).click((event) => {
      if (!event.target.classList.contains('h5p-dialogcards-quick-progression')) {
        return;
      }
      this.callbacks.onNextCard({cardId: this.id, result: true});
    }).addClass('correct')
      .addClass(classesRepetition)
      .attr('tabindex', attributeTabindex)
      .appendTo($cardFooter);

    return $cardFooter;
  }

  /**
   * Show summary button on last card.
   *
   * @param {function} callback Callback called on button click.
   */
  showSummaryButton(callback) {
    // Hide answer buttons
    this.getDOM()
      .find('.h5p-dialogcards-answer-button')
      .addClass('h5p-dialogcards-button-hidden')
      .attr('tabindex', '-1');

    // Swap turn button with show summary button
    this.buttonTurn
      .addClass('h5p-dialogcards-button-gone');

    this.buttonShowSummary
      .click(() => callback())
      .removeClass('h5p-dialogcards-button-gone');
  }

  /**
   * Show the opposite site of the card.
   */
  turnCard() {
    const $card = this.getDOM();
    const $c = $card.find('.h5p-dialogcards-card-content');
    const $ch = $card.find('.h5p-dialogcards-cardholder').addClass('h5p-dialogcards-collapse');

    // Removes tip, since it destroys the animation:
    $c.find('.joubel-tip-container').remove();

    // Check if card has been turned before
    const turned = $c.hasClass('h5p-dialogcards-turned');

    // Update HTML class for card
    $c.toggleClass('h5p-dialogcards-turned', !turned);

    setTimeout(() => {
      $ch.removeClass('h5p-dialogcards-collapse');
      this.changeText($c, this.params.dialogs[$card.index()][turned ? 'text' : 'answer']);
      if (turned) {
        $ch.find('.h5p-audio-inner').removeClass('hide');
      }
      else {
        this.removeAudio($ch);
      }

      // Toggle state for knowledge confirmation buttons
      if (this.params.mode === 'repetition' && !this.params.quickProgression) {
        const $answerButtons = $card.find('.h5p-dialogcards-answer-button');
        const attributeTabindex = turned ? '-1' : '0';
        $answerButtons
          .toggleClass('h5p-dialogcards-quick-progression', !turned)
          .attr('tabindex', attributeTabindex);
      }

      // Add backside tip
      // Had to wait a little, if not Chrome will displace tip icon
      setTimeout(() => {
        this.addTipToCard($c, turned ? 'front' : 'back');

        if (typeof this.callbacks.onCardTurned === 'function') {
          this.callbacks.onCardTurned(turned);
        }
      }, 200);

      this.resizeOverflowingText();

      // Focus text
      $card.find('.h5p-dialogcards-card-text-area').focus();
    }, 200);
  }

  /**
   * Change text of card, used when turning cards.
   *
   * @param {jQuery} $card Card to change text on.
   * @param {string} text Text to set.
   */
  changeText($card, text) {
    const $cardText = $card.find('.h5p-dialogcards-card-text-area');
    $cardText.html(text);
    $cardText.toggleClass('hide', (!text || !text.length));
  }

  /**
   * Resize the font-size of text areas that tend to overflow when dialog cards
   * is squeezed into a tiny container.
   */
  resizeOverflowingText() {
    if (!this.params.behaviour.scaleTextNotCard) {
      return; // No text scaling today
    }

    // Resize card text if needed
    const $textContainer = this.getDOM().find('.h5p-dialogcards-card-text');
    const $text = $textContainer.children();
    this.resizeTextToFitContainer($textContainer, $text);
  }

  /**
   * Increase or decrease font size so text wil fit inside container.
   *
   * @param {jQuery} $textContainer Outer container, must have a set size.
   * @param {jQuery} $text Inner text container
   */
  resizeTextToFitContainer($textContainer, $text) {
    // Reset text size
    $text.css('font-size', '');

    // Measure container and text height
    const currentTextContainerHeight = $textContainer.get(0).getBoundingClientRect().height;
    let currentTextHeight = $text.get(0).getBoundingClientRect().height;
    const parentFontSize = parseFloat($textContainer.css('font-size'));
    let fontSize = parseFloat($text.css('font-size'));

    // TODO: Don't get $inner this way
    const $inner = $(document).find('.h5p-container');
    const mainFontSize = parseFloat($inner.css('font-size'));

    // Decrease font size
    if (currentTextHeight > currentTextContainerHeight) {
      let decreaseFontSize = true;
      while (decreaseFontSize) {

        fontSize -= Card.SCALEINTERVAL;

        if (fontSize < Card.MINSCALE) {
          decreaseFontSize = false;
          break;
        }

        $text.css('font-size', (fontSize / parentFontSize) + 'em');

        currentTextHeight = $text.get(0).getBoundingClientRect().height;
        if (currentTextHeight <= currentTextContainerHeight) {
          decreaseFontSize = false;
        }
      }

    }
    else { // Increase font size
      let increaseFontSize = true;
      while (increaseFontSize) {
        fontSize += Card.SCALEINTERVAL;

        // Cap at  16px
        if (fontSize > mainFontSize) {
          increaseFontSize = false;
          break;
        }

        // Set relative font size to scale with full screen.
        $text.css('font-size', fontSize / parentFontSize + 'em');
        currentTextHeight = $text.get(0).getBoundingClientRect().height;
        if (currentTextHeight >= currentTextContainerHeight) {
          increaseFontSize = false;
          fontSize = fontSize- Card.SCALEINTERVAL;
          $text.css('font-size', fontSize / parentFontSize + 'em');
        }
      }
    }
  }

  /**
   * Adds tip to a card
   *
   * @param {jQuery} $card The card
   * @param {String} [side=front] Which side of the card
   * @param {Number} [index] Index of card
   */
  addTipToCard($card, side, index) {
    // Make sure we have a side
    if (side !== 'back') {
      side = 'front';
    }

    // Make sure we have an index

    if (index === undefined) {
      index = this.id;
    }

    // Remove any old tips
    $card.find('.joubel-tip-container').remove();

    // Add new tip if set and has length after trim
    const tips = this.params.dialogs[index].tips;
    if (tips !== undefined && tips[side] !== undefined) {
      const tip = tips[side].trim();
      if (tip.length) {
        $card.find('.h5p-dialogcards-card-text-wrapper .h5p-dialogcards-card-text-inner')
          .after(H5P.JoubelUI.createTip(tip, {
            tipLabel: this.params.tipButtonLabel
          }));
      }
    }
  }

  /**
   * Set focus to a given card
   */
  setCardFocus() {
    // Wait for transition, then set focus
    this.getDOM().one('transitionend', () => {
      this.getDOM().find('.h5p-dialogcards-card-text-area').focus();
    });
  }

  /**
   * Stop audio of card.
   */
  stopAudio() {
    if (this.audio && this.audio.stop) {
      this.audio.stop();
    }
  }

  /**
   * Hide audio button.
   *
   * @param $card
   */
  removeAudio() {
    this.stopAudio();
    this.getDOM().find('.h5p-audio-inner').addClass('hide');
  }

  /**
   * Get card's DOM
   *
   * @return {jQuery} Card's DOM.
   */
  getDOM() {
    return this.$cardWrapper;
  }

  /**
   * Get card's Image.
   *
   * @return {jQuery} Card's image.
   */
  getImage() {
    return this.$image;
  }

  /**
   * Get card's Image.
   *
   * @return {jQuery} Card's image.
   */
  getImageSize() {
    return this.image ? {width: this.image.width, height: this.image.height} : this.image;
  }

  /**
   * Get card's Image.
   *
   * @return {Element} Card's image.
   */
  getAudio() {
    return this.$audioWrapper;
  }
}

// Constants
Card.SCALEINTERVAL = 0.2;
Card.MAXSCALE = 16;
Card.MINSCALE = 4;

export default Card;
