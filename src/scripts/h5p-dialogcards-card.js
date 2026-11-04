const $ = H5P.jQuery;

class Card {
  /**
   * @constructor
   *
   * @param {object} card Card parameters
   * @param {object} params Parent's params
   * @param {number} id Card number in order of appearance
   * @param {object} [callbacks] Callbacks.
   * @param {function} [callbacks.onCardSize] Call when card needs resize.
   * @param {function} [callbacks.onCardTurned] Call when card was turned.
   * @param {number} idCounter
   */
  constructor(card, params, id, contentId, callbacks = {}, idCounter) {
    this.card = card;
    this.params = params || {};
    this.id = id;
    this.contentId = contentId;
    this.callbacks = callbacks;

    // Check if to use front settings for back, too
    if (this.card.back.useImageFromFront) {
      this.card.back.image = this.card.front.image;
      this.card.back.imageAltText = this.card.front.imageAltText;
    }

    if (this.card.back.useAudioFromFront) {
      this.card.back.audio = this.card.front.audio;
    }

    this.audios = {};
    this.$audioWrappers = {}

    this.$cardWrapper = $('<div>', {
      class: 'h5p-dialogcards-cardwrap',
      role: 'group',
      tabindex: '-1',
    });

    this.$cardWrapper.addClass(`h5p-dialogcards-mode-${this.params.mode}`);

    if (this.params.mode !== 'repetition') {
      this.$cardWrapper.attr('aria-labelledby', `h5p-dialogcards-progress-${idCounter}`);
    }

    this.$cardHolder = $('<div>', { class: 'h5p-dialogcards-cardholder h5p-cardholder' })
      .appendTo(this.$cardWrapper);

    this.createCardContent(card)
      .appendTo(this.$cardHolder);

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
      class: 'h5p-dialogcards-card-content',
    });

    // Images
    this.$imageWrapper = $('<div>', {
      'class': 'h5p-dialogcards-image-wrapper'
    });
    this.createCardImage(card, 'front').appendTo(this.$imageWrapper);
    this.createCardImage(card, 'back').appendTo(this.$imageWrapper);
    this.$imageWrapper.appendTo($cardContent);

    const $cardTextWrapper = $('<div>', {
      class: 'h5p-dialogcards-card-text-wrapper',
    }).appendTo($cardContent);

    const $cardTextInner = $('<div>', {
      class: 'h5p-dialogcards-card-text-inner',
    }).appendTo($cardTextWrapper);

    const $cardTextInnerContent = $('<div>', {
      class: 'h5p-dialogcards-card-text-inner-content',
    }).appendTo($cardTextInner);

    // Front audio
    this.$audioWrappers.front = this.createCardAudio(card, 'front')
      .appendTo($cardTextInnerContent);

    // Back audio
    this.$audioWrappers.back = this.createCardAudio(card, 'back')
      .appendTo($cardTextInnerContent);

    const $cardText = $('<div>', {
      class: 'h5p-dialogcards-card-text',
    }).appendTo($cardTextInnerContent);

    this.$cardTextArea = $('<div>', {
      'class': 'h5p-dialogcards-card-text-area',
      'tabindex': '-1',
      'html': card.front.text
    }).appendTo($cardText);

    this.createCardFooter()
      .appendTo($cardTextWrapper);

    return $cardContent;
  }

  /**
   * Process HTML escaped string for use as attribute value,
   * e.g. for alt text or title attributes.
   *
   * @param {string} value
   * @return {string} WARNING! Do NOT use for innerHTML.
   */
  massageAttributeOutput(value) {
    const dparser = new DOMParser().parseFromString(value, 'text/html');
    const div = document.createElement('div');
    div.innerHTML = dparser.documentElement.textContent;
    return div.textContent || div.innerText || '';
  }

  /**
   * Create card image
   *
   * @param {object} card Card parameters
   * @param {string} side Side, either front or back.
   * @returns {*|jQuery|HTMLElement} Card image wrapper
   */
  createCardImage(card, side) {
    let $image;

    if (card[side].image !== undefined) {
      $image = $(`<img class="h5p-dialogcards-image" src="${H5P.getPath(card[side].image.path, this.contentId)}"/>`);
      $image.addClass(`h5p-dialogcards-image-${side}`);

      if (card[side].imageAltText) {
        $image.attr('alt', this.massageAttributeOutput(card[side].imageAltText));
      }
    }
    else {
      $image = $('<div class="h5p-dialogcards-image"></div>');
    }

    return $image;
  }

  /**
   * Create card audio.
   *
   * @param {object} card Card parameters.
   * @param {string} side Side, either front or back.
   * @returns {*|jQuery|HTMLElement} Card audio element.
   */
  createCardAudio(card, side = 'front') {
    const $audioWrapper = $('<div>')
      .addClass('h5p-dialogcards-audio-wrapper')
      .addClass(`h5p-dialogcards-audio-wrapper-${side}`);

    if (!card[side].text || card[side].text === '') {
      $audioWrapper.addClass('h5p-no-text');
    }

    if (card[side].audio !== undefined) {
      const audioDefaults = {
        files: card[side].audio,
        audioNotSupported: this.params.audioNotSupported,
      };

      const audio = new H5P.Audio(audioDefaults, this.contentId);
      this.audios[side] = audio;
      audio.attach($audioWrapper);

      // Have to stop else audio will take up a socket pending forever in chrome.
      if (audio.audio && audio.audio.preload) {
        audio.audio.preload = 'none';
      }
    }
    else {
      // Keep space for audio button if other side has audio to prevent resizing
      const otherSide = (side === 'front') ? 'back' : 'front';
      $audioWrapper.addClass(
        card[otherSide].audio !== undefined ? 'h5p-dialogcards-audio-placeholder' : 'hide',
      );
    }

    return $audioWrapper;
  }

  /**
   * Create card footer
   *
   * @returns {*|jQuery|HTMLElement} Card footer element
   */
  createCardFooter() {
    const $cardFooter = $('<div>', {
      class: 'h5p-dialogcards-card-footer',
    });

    let classesRepetition = 'h5p-dialogcards-button-hidden';
    let attributeTabindex = '-1';

    if (this.params.mode === 'repetition') {
      classesRepetition = '';
      if (this.params.behaviour.quickProgression) {
        classesRepetition = 'h5p-dialogcards-quick-progression';
        attributeTabindex = '0';
      }
    }

    this.$buttonTurn = $(H5P.Components.Button({
      label: this.params.answer,
      icon: 'flip',
    })).appendTo($cardFooter);

    if (this.params.mode === 'repetition') {
      this.$buttonShowSummary = $(H5P.Components.Button({
        classes: 'h5p-dialogcards-show-summary h5p-dialogcards-button-gone h5p-theme-results',
        styleType: 'secondary',
        label: this.params.showSummary,
        icon: 'show-results',
      })).appendTo($cardFooter);

      this.$buttonIncorrect = $(H5P.Components.Button({
        classes: `h5p-dialogcards-answer-button incorrect ${classesRepetition}`,
        label: this.params.incorrectAnswer,
        disabled: !this.params.behaviour.quickProgression,
        tabIndex: attributeTabindex,
        styleType: 'secondary',
        onClick: (event) => {
          this.handleAnswerButton(event, false);
        },
      })).appendTo($cardFooter);

      this.$buttonCorrect = $(H5P.Components.Button({
        classes: `h5p-dialogcards-answer-button correct ${classesRepetition}`,
        label: this.params.correctAnswer,
        disabled: !this.params.behaviour.quickProgression,
        tabIndex: attributeTabindex,
        styleType: 'secondary',
        onClick: (event) => {
          this.handleAnswerButton(event, true);
        },
      })).appendTo($cardFooter);
    }

    return $cardFooter;
  }

  handleAnswerButton(event, result) {
    if (this.params.mode === 'repetition') {
      const button = event.target.closest('.h5p-dialogcards-answer-button');
      if (!button.classList.contains('h5p-dialogcards-quick-progression')) {
        return;
      }
      this.callbacks.onNextCard({ cardId: this.id, result });
    }
  }

  /**
   * Create button listeners.
   * Will be lost when the element is removed from DOM.
   */
  createButtonListeners() {
    this.$buttonTurn
      .unbind('click')
      .click(() => {
        this.turnCard();
      });
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
    this.$buttonTurn
      .addClass('h5p-dialogcards-button-gone');

    this.$buttonShowSummary
      .click(() => callback())
      .removeClass('h5p-dialogcards-button-gone')
      .focus();
  }

  /**
   * Hide summary button and show answer buttons again.
   */
  hideSummaryButton() {
    if (this.params.mode === 'normal') {
      return;
    }

    this.getDOM()
      .find('.h5p-dialogcards-answer-button')
      .removeClass('h5p-dialogcards-button-hidden')
      .attr('tabindex', '0');

    // Swap turn button with show summary button
    this.$buttonTurn
      .removeClass('h5p-dialogcards-button-gone');

    this.$buttonShowSummary
      .addClass('h5p-dialogcards-button-gone')
      .off('click');
  }

  /**
   * Show the opposite side of the card.
   */
  turnCard() {
    const $card = this.getDOM();
    const $c = $card.find('.h5p-dialogcards-card-content');
    const $ch = $card.find('.h5p-dialogcards-cardholder');

    // Removes tip, since it destroys the animation:
    $c.find('.joubel-tip-container').remove();

    // Check if card has been turned before
    const turned = this.isTurned();

    const handleFlipEnd = (e) => {
      if (e.target !== $ch.get(0)) {
        return; // Ignore child transitions
      }

      $ch.off('transitionend', handleFlipEnd);

      /*
       * Update HTML class for card. Must happen while card is collapsed, as
       * the class determines which side's image and audio are displayed.
       */
      $c.toggleClass('h5p-dialogcards-turned', !turned);

      $ch.removeClass('h5p-dialogcards-collapse');
      this.changeText(turned ? this.getText() : this.getAnswer());

      // Image shown/hidden via CSS

      // Audio buttons shown/hidden via CSS
      this.stopAudio()

      // Toggle state for knowledge confirmation buttons
      if (this.params.mode === 'repetition' && !this.params.behaviour.quickProgression) {
        const $answerButtons = $card.find('.h5p-dialogcards-answer-button');

        // Don't revoke quick progression after card was turned.
        if ($answerButtons.hasClass('h5p-dialogcards-quick-progression') === false) {
          $answerButtons
            .addClass('h5p-dialogcards-quick-progression')
            .attr('tabindex', 0)
            .attr('disabled', false);
        }
      }

      this.addTipToCard($c, turned ? 'front' : 'back');

      if (typeof this.callbacks.onCardTurned === 'function') {
        this.callbacks.onCardTurned(turned);
      }


      this.resizeOverflowingText();

      if (!this.params.behaviour.scaleTextNotCard) {
        this.callbacks.onCardSize();
      }

      // Focus text
      this.$cardTextArea.focus();
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      handleFlipEnd({ target: $ch.get(0) });
    }
    else {
      $ch.addClass('h5p-dialogcards-collapse');
      $ch.on('transitionend', handleFlipEnd);
    }
  }

  /**
   * Change text of card, used when turning cards.
   *
   * @param {string} text Text to set.
   */
  changeText(text) {
    this.$cardTextArea.html(text);
    this.$cardTextArea.toggleClass('hide', (!text || !text.length));
  }

  /**
   * Set progress for assistive technologies.
   * @param {number} position Position.
   * @param {number} max Maximum position.
   */
  setProgressText(position, total) {
    if (this.params.mode !== 'repetition') {
      return;
    }

    const progressText = this.params.progressText
      .replace('@card', (position).toString())
      .replace('@total', (total).toString());

    this.$cardWrapper.attr('aria-label', progressText);
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

    const $inner = this.getDOM().closest('.h5p-container');
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

        $text.css('font-size', `${fontSize / parentFontSize}em`);

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
        $text.css('font-size', `${fontSize / parentFontSize}em`);
        currentTextHeight = $text.get(0).getBoundingClientRect().height;
        if (currentTextHeight >= currentTextContainerHeight) {
          increaseFontSize = false;
          fontSize -= Card.SCALEINTERVAL;
          $text.css('font-size', `${fontSize / parentFontSize}em`);
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
    const tip = (this.card[side].tip || '').trim();
    if (tip.length) {
      $card.find('.h5p-dialogcards-card-text-wrapper .h5p-dialogcards-card-text-inner')
        .after(H5P.JoubelUI.createTip(tip, {
          tipLabel: this.params.tipButtonLabel,
        }));
    }
  }

  /**
   * Set focus to a given card.
   * @param {boolean} force If true, don't wait for transition.
   */
  setCardFocus(force) {
    if (force === true) {
      this.$cardTextArea.focus();
    }
    else {
      const $card = this.getDOM();

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        $card.get(0).focus();
        return;
      }

      const handleTransitionEnd = (e) => {
        if (e.target === $card.get(0)) {
          $card.get(0).focus();
        }
        // The transitionend event must have been dispatched from a child element.
        // Let's try to listen once more to see if it is the card.
        else {
          $card.one('transitionend', handleTransitionEnd);
        }
      };

      $card.one('transitionend', handleTransitionEnd);
    }
  }

  /**
   * Stop audio of card.
   */
  stopAudio() {
    const sides = ['front', 'back'];
    sides.forEach(side => {
      if (!this.audios[side] || !this.audios[side].audio) {
        return;
      }

      /*
       * We need to reset the audio button to its initial visual state, but it
       * doesn't have a function to to that -> force ended event and reload.
       */
      const { duration } = this.audios[side].audio;
      if (duration > 0 && duration < Number.MAX_SAFE_INTEGER) {
        this.audios[side].seekTo(duration);
      }

      if (this.audios[side].audio.load) {
        setTimeout(() => {
          this.audios[side].audio.load();
        }, 100);
      }
    });
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
   * Set no text mode.
   */
  setNoText() {
    this.getDOM().addClass('h5p-no-text');
  }

  /**
   * Get card's text.
   *
   * @return {string} Card's text.
   */
  getText() {
    return this.card.front.text;
  }

  /**
   * Get card's answer.
   *
   * @return {string} Card's answer.
   */
  getAnswer() {
    return this.card.back.text;
  }

  /**
   * Get card's image wrapper.
   *
   * @return {jQuery} Card's image.
   */
  getImageWrapper() {
    return this.$imageWrapper;
  }

  /**
   * Set card image height.
   * @param {string} height CSS height value.
   */
  setImageHeight(height) {
    this.$imageWrapper.css('height', height);
  }

  /**
   * Get card's Audio.
   *
   * @return {Element} Card's audio.
   */
  getAudio() {
    return this.isTurned() ? this.$audioWrappers.back : this.$audioWrappers.front;
  }

  /**
   * Detect whether card is turned.
   * @return {boolean} True, if card is turned.
   */
  isTurned() {
    return this.getDOM()
      .find('.h5p-dialogcards-card-content')
      .hasClass('h5p-dialogcards-turned');
  }

  /**
   * Reset card.
   */
  reset() {
    const $card = this.getDOM();

    $card.removeClass('h5p-dialogcards-previous');
    $card.removeClass('h5p-dialogcards-current');

    this.changeText(this.getText());

    const $cardContent = $card.find('.h5p-dialogcards-card-content');
    $cardContent.removeClass('h5p-dialogcards-turned');
    this.addTipToCard($cardContent, 'front', this.id);

    if (!this.params.behaviour.quickProgression) {
      $card.find('.h5p-dialogcards-answer-button').removeClass('h5p-dialogcards-quick-progression');
    }
    this.hideSummaryButton();
  }
}

// Constants
Card.SCALEINTERVAL = 0.2;
Card.MAXSCALE = 16;
Card.MINSCALE = 4;

export default Card;
