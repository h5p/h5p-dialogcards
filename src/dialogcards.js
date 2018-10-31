/**
 * Dialogcards module
 *
 * @param {jQuery} $
 */
H5P.Dialogcards = (function ($, Audio, JoubelUI) {

  /**
   * Initialize module.
   *
   * @param {Object} params Behavior settings
   * @param {Number} id Content identification
   * @param {Object} contentData
   * @returns {C} self
   */
  function C(params, id, contentData) {
    H5P.EventDispatcher.call(this);

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

    this._current = -1;
    this._turned = [];
    this.$images = [];
    this.audios = [];
  }

  C.prototype = Object.create(H5P.EventDispatcher.prototype);
  C.prototype.constructor = C;

  /**
   * Attach h5p inside the given container.
   *
   * @param {jQuery} $container
   */
  C.prototype.attach = function ($container) {
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
  C.prototype.createFooter = function () {
    const $footer = $('<nav>', {
      'class': 'h5p-dialogcards-footer',
      'role': 'navigation'
    });

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

    return $footer;
  };

  /**
   * Called when all cards has been loaded.
   */
  C.prototype.updateImageSize = function () {
    // Find highest card content
    let relativeHeightCap = 15;
    let height = 0;
    let i;
    let foundImage = false;
    for (i = 0; i < this.params.dialogs.length; i++) {
      const card = this.params.dialogs[i];
      const $card = this.$current.find('.h5p-dialogcards-card-content');

      if (card.image === undefined) {
        continue;
      }
      foundImage = true;
      const imageHeight = card.image.height / card.image.width * $card.get(0).getBoundingClientRect().width;

      if (imageHeight > height) {
        height = imageHeight;
      }
    }

    if (foundImage) {
      let relativeImageHeight = height / parseFloat(this.$inner.css('font-size'));
      if (relativeImageHeight > relativeHeightCap) {
        relativeImageHeight = relativeHeightCap;
      }
      this.$images.forEach($img => {
        $img.parent().css('height', relativeImageHeight + 'em');
      });
    }
  };

  /**
   * Adds tip to a card
   *
   * @param {jQuery} $card The card
   * @param {String} [side=front] Which side of the card
   * @param {Number} [index] Index of card
   */
  C.prototype.addTipToCard = function ($card, side, index) {
    // Make sure we have a side
    if (side !== 'back') {
      side = 'front';
    }

    // Make sure we have an index

    if (index === undefined) {
      index = this.$current.index();
    }

    // Remove any old tips
    $card.find('.joubel-tip-container').remove();

    // Add new tip if set and has length after trim
    const tips = this.params.dialogs[index].tips;
    if (tips !== undefined && tips[side] !== undefined) {
      const tip = tips[side].trim();
      if (tip.length) {
        $card.find('.h5p-dialogcards-card-text-wrapper .h5p-dialogcards-card-text-inner')
          .after(JoubelUI.createTip(tip, {
            tipLabel: this.params.tipButtonLabel
          }));
      }
    }
  };

  /**
   * Creates all cards and appends them to card wrapper.
   *
   * @param {Array} cards Card parameters
   * @returns {*|jQuery|HTMLElement} Card wrapper set
   */
  C.prototype.initCards = function (cards) {
    let loaded = 0;
    const initLoad = 2;

    // Randomize cards order
    if (this.params.behaviour.randomCards) {
      cards = H5P.shuffleArray(cards);
    }

    this.$cardwrapperSet = $('<div>', {
      'class': 'h5p-dialogcards-cardwrap-set'
    });

    const setCardSizeCallback = () => {
      loaded++;
      if (loaded === initLoad) {
        this.resize();
      }
    };

    for (let i = 0; i < cards.length; i++) {
      // Load cards progressively
      if (i >= initLoad) {
        break;
      }

      const $cardWrapper = this.createCard(cards[i], i, setCardSizeCallback);

      // Set current card
      if (i === 0) {
        $cardWrapper.addClass('h5p-dialogcards-current');
        this.$current = $cardWrapper;
      }

      this.addTipToCard($cardWrapper.find('.h5p-dialogcards-card-content'), 'front', i);

      this.$cardwrapperSet.append($cardWrapper);
    }

    return this.$cardwrapperSet;
  };

  /**
   * Create a single card card
   *
   * @param {Object} card Card parameters
   * @param {number} cardNumber Card number in order of appearance
   * @param {Function} [setCardSizeCallback] Set card size callback
   * @returns {*|jQuery|HTMLElement} Card wrapper
   */
  C.prototype.createCard = function (card, cardNumber, setCardSizeCallback) {
    const $cardWrapper = $('<div>', {
      'class': 'h5p-dialogcards-cardwrap'
    });

    const $cardHolder = $('<div>', {
      'class': 'h5p-dialogcards-cardholder'
    }).appendTo($cardWrapper);

    // Progress for assistive technologies
    const progressText = this.params.progressText
      .replace('@card', (cardNumber + 1).toString())
      .replace('@total', (this.params.dialogs.length).toString());

    $('<div>', {
      'class': 'h5p-dialogcards-at-progress',
      'text': progressText
    }).appendTo($cardHolder);

    this.createCardContent(card, cardNumber, setCardSizeCallback)
      .appendTo($cardHolder);

    return $cardWrapper;

  };

  /**
   * Create content for a card
   *
   * @param {Object} card Card parameters
   * @param {number} cardNumber Card number in order of appearance
   * @param {Function} [setCardSizeCallback] Set card size callback
   * @returns {*|jQuery|HTMLElement} Card content wrapper
   */
  C.prototype.createCardContent = function (card, cardNumber, setCardSizeCallback) {
    const $cardContent = $('<div>', {
      'class': 'h5p-dialogcards-card-content'
    });


    this.createCardImage(card, setCardSizeCallback)
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
  };

  /**
   * Create card footer
   *
   * @returns {*|jQuery|HTMLElement} Card footer element
   */
  C.prototype.createCardFooter = function () {
    const $cardFooter = $('<div>', {
      'class': 'h5p-dialogcards-card-footer'
    });

    JoubelUI.createButton({
      'class': 'h5p-dialogcards-turn',
      'html': this.params.answer
    }).click(event => {
      this.turnCard($(event.target).parents('.h5p-dialogcards-cardwrap'));
    }).appendTo($cardFooter);

    return $cardFooter;
  };

  /**
   * Create card image
   *
   * @param {Object} card Card parameters
   * @param {Function} [loadCallback] Function to call when loading image
   * @returns {*|jQuery|HTMLElement} Card image wrapper
   */
  C.prototype.createCardImage = function (card, loadCallback) {
    let $image;
    const $imageWrapper = $('<div>', {
      'class': 'h5p-dialogcards-image-wrapper'
    });

    if (card.image !== undefined) {
      $image = $('<img class="h5p-dialogcards-image" src="' + H5P.getPath(card.image.path, this.id) + '"/>');
      if (loadCallback) {
        $image.load(loadCallback);
      }

      if (card.imageAltText) {
        $image.attr('alt', card.imageAltText);
      }
    }
    else {
      $image = $('<div class="h5p-dialogcards-image"></div>');
      if (loadCallback) {
        loadCallback();
      }
    }
    this.$images.push($image);
    $image.appendTo($imageWrapper);

    return $imageWrapper;
  };

  /**
   * Create card audio
   *
   * @param {Object} card Card parameters
   * @returns {*|jQuery|HTMLElement} Card audio element
   */
  C.prototype.createCardAudio = function (card) {
    let audio;
    const $audioWrapper = $('<div>', {
      'class': 'h5p-dialogcards-audio-wrapper'
    });
    if (card.audio !== undefined) {

      const audioDefaults = {
        files: card.audio,
        audioNotSupported: this.params.audioNotSupported
      };

      audio = new Audio(audioDefaults, this.id);
      audio.attach($audioWrapper);

      // Have to stop else audio will take up a socket pending forever in chrome.
      if (audio.audio && audio.audio.preload) {
        audio.audio.preload = 'none';
      }
    }
    else {
      $audioWrapper.addClass('hide');
    }
    this.audios.push(audio);

    return $audioWrapper;
  };

  /**
   * Update navigation text and show or hide buttons.
   */
  C.prototype.updateNavigation = function () {
    if (this.$current.next('.h5p-dialogcards-cardwrap').length) {
      this.$next.removeClass('h5p-dialogcards-disabled');
      this.$retry.addClass('h5p-dialogcards-disabled');
    }
    else {
      this.$next.addClass('h5p-dialogcards-disabled');
    }

    if (this.$current.prev('.h5p-dialogcards-cardwrap').length && !this.params.behaviour.disableBackwardsNavigation) {
      this.$prev.removeClass('h5p-dialogcards-disabled');
    }
    else {
      this.$prev.addClass('h5p-dialogcards-disabled');
    }

    this.$progress.text(this.params.progressText.replace('@card', this.$current.index() + 1).replace('@total', this.params.dialogs.length));
    this.resizeOverflowingText();
  };

  /**
   * Show next card.
   */
  C.prototype.nextCard = function () {
    const $next = this.$current.next('.h5p-dialogcards-cardwrap');

    // Next card not loaded or end of cards
    if ($next.length) {
      this.stopAudio(this.$current.index());
      this.$current.removeClass('h5p-dialogcards-current').addClass('h5p-dialogcards-previous');
      this.$current = $next.addClass('h5p-dialogcards-current');
      this.setCardFocus(this.$current);

      // Add next card.
      const $loadCard = this.$current.next('.h5p-dialogcards-cardwrap');
      if (!$loadCard.length && this.$current.index() + 1 < this.params.dialogs.length) {
        const $cardWrapper = this.createCard(this.params.dialogs[this.$current.index() + 1], this.$current.index() + 1)
          .appendTo(this.$cardwrapperSet);
        this.addTipToCard($cardWrapper.find('.h5p-dialogcards-card-content'), 'front', this.$current.index() + 1);
        this.resize();
      }

      // Update navigation
      this.updateNavigation();
    }
  };

  /**
   * Show previous card.
   */
  C.prototype.prevCard = function () {
    const $prev = this.$current.prev('.h5p-dialogcards-cardwrap');

    if ($prev.length) {
      this.stopAudio(this.$current.index());
      this.$current.removeClass('h5p-dialogcards-current');
      this.$current = $prev.addClass('h5p-dialogcards-current').removeClass('h5p-dialogcards-previous');
      this.setCardFocus(this.$current);
      this.updateNavigation();
    }
  };

  /**
   * Show the opposite site of the card.
   *
   * @param {jQuery} $card
   */
  C.prototype.turnCard = function ($card) {
    const $c = $card.find('.h5p-dialogcards-card-content');
    const $ch = $card.find('.h5p-dialogcards-cardholder').addClass('h5p-dialogcards-collapse');

    // Removes tip, since it destroys the animation:
    $c.find('.joubel-tip-container').remove();

    // Check if card has been turned before
    const turned = $c.hasClass('h5p-dialogcards-turned');
    this.$cardSideAnnouncer.html(turned ? this.params.cardFrontLabel : this.params.cardBackLabel);

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

      // Add backside tip
      // Had to wait a little, if not Chrome will displace tip icon
      setTimeout(() => {
        this.addTipToCard($c, turned ? 'front' : 'back');
        if (!this.$current.next('.h5p-dialogcards-cardwrap').length) {
          if (this.params.behaviour.enableRetry) {
            this.$retry.removeClass('h5p-dialogcards-disabled');
            this.truncateRetryButton();
            this.resizeOverflowingText();
          }
        }
      }, 200);

      this.resizeOverflowingText();

      // Focus text
      $card.find('.h5p-dialogcards-card-text-area').focus();
    }, 200);
  };

  /**
   * Change text of card, used when turning cards.
   *
   * @param $card
   * @param text
   */
  C.prototype.changeText = function ($card, text) {
    const $cardText = $card.find('.h5p-dialogcards-card-text-area');
    $cardText.html(text);
    $cardText.toggleClass('hide', (!text || !text.length));
  };

  /**
   * Stop audio of card with cardindex

   * @param {Number} cardIndex Index of card
   */
  C.prototype.stopAudio = function (cardIndex) {
    const audio = this.audios[cardIndex];
    if (audio && audio.stop) {
      audio.stop();
    }
  };

  /**
   * Hide audio button
   *
   * @param $card
   */
  C.prototype.removeAudio = function ($card) {
    this.stopAudio($card.closest('.h5p-dialogcards-cardwrap').index());
    $card.find('.h5p-audio-inner')
      .addClass('hide');
  };

  /**
   * Show all audio buttons
   */
  C.prototype.showAllAudio = function () {
    this.$cardwrapperSet.find('.h5p-audio-inner')
      .removeClass('hide');
  };

  /**
   * Reset the task so that the user can do it again.
   */
  C.prototype.reset = function () {
    const self = this;
    const $cards = this.$inner.find('.h5p-dialogcards-cardwrap');

    this.stopAudio(this.$current.index());
    this.$current.removeClass('h5p-dialogcards-current');
    this.$current = $cards.filter(':first').addClass('h5p-dialogcards-current');
    this.updateNavigation();

    $cards.each(function (index) {
      // Here "this" references the jQuery object
      const $card = $(this).removeClass('h5p-dialogcards-previous');
      self.changeText($card, self.params.dialogs[$card.index()].text);
      const $cardContent = $card.find('.h5p-dialogcards-card-content');
      $cardContent.removeClass('h5p-dialogcards-turned');
      self.addTipToCard($cardContent, 'front', index);
    });
    this.$retry.addClass('h5p-dialogcards-disabled');
    this.showAllAudio();
    this.resizeOverflowingText();
    this.setCardFocus(this.$current);
  };

  /**
   * Update the dimensions of the task when resizing the task.
   */
  C.prototype.resize = function () {
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
    this.resizeOverflowingText();
  };

  /**
   * Resizes each card to fit its text
   */
  C.prototype.determineCardSizes = function () {
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
      self.changeText($content, self.params.dialogs[i].answer);

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
      self.changeText($content, self.params.dialogs[i].text);
    });
  };

  C.prototype.scaleToFitHeight = function () {
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
          newFontSize -= C.SCALEINTERVAL;

          // Cap at min font size
          if (newFontSize < C.MINSCALE) {
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
          newFontSize += C.SCALEINTERVAL;

          // Cap max font size
          if (newFontSize > C.MAXSCALE) {
            increaseFontSize = false;
            break;
          }

          // Set relative font size to scale with full screen.
          let relativeFontSize = newFontSize / parentFontSize;
          this.$inner.css('font-size', relativeFontSize + 'em');
          contentHeight = getContentHeight();
          if (containerHeight <= contentHeight) {
            increaseFontSize = false;
            relativeFontSize = (newFontSize - C.SCALEINTERVAL) / parentFontSize;
            this.$inner.css('font-size', relativeFontSize + 'em');
          }
        }
      }
    }
    else { // Resize mobile view
      this.resizeOverflowingText();
    }
  };

  /**
   * Resize the font-size of text areas that tend to overflow when dialog cards
   * is squeezed into a tiny container.
   */
  C.prototype.resizeOverflowingText = function () {
    if (!this.params.behaviour.scaleTextNotCard) {
      return; // No text scaling today
    }

    // Resize card text if needed
    const $textContainer = this.$current.find('.h5p-dialogcards-card-text');
    const $text = $textContainer.children();
    this.resizeTextToFitContainer($textContainer, $text);
  };

  /**
   * Increase or decrease font size so text wil fit inside container.
   *
   * @param {jQuery} $textContainer Outer container, must have a set size.
   * @param {jQuery} $text Inner text container
   */
  C.prototype.resizeTextToFitContainer = function ($textContainer, $text) {
    // Reset text size
    $text.css('font-size', '');

    // Measure container and text height
    const currentTextContainerHeight = $textContainer.get(0).getBoundingClientRect().height;
    let currentTextHeight = $text.get(0).getBoundingClientRect().height;
    const parentFontSize = parseFloat($textContainer.css('font-size'));
    let fontSize = parseFloat($text.css('font-size'));
    const mainFontSize = parseFloat(this.$inner.css('font-size'));

    // Decrease font size
    if (currentTextHeight > currentTextContainerHeight) {
      let decreaseFontSize = true;
      while (decreaseFontSize) {

        fontSize -= C.SCALEINTERVAL;

        if (fontSize < C.MINSCALE) {
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
        fontSize += C.SCALEINTERVAL;

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
          fontSize = fontSize- C.SCALEINTERVAL;
          $text.css('font-size', fontSize / parentFontSize + 'em');
        }
      }
    }
  };

  /**
   * Set focus to a given card
   *
   * @param {jQuery} $card Card that should get focus
   */
  C.prototype.setCardFocus = function ($card) {
    // Wait for transition, then set focus
    $card.one('transitionend', function () {
      $card.find('.h5p-dialogcards-card-text-area').focus();
    });
  };

  /**
   * Truncate retry button if width is small.
   */
  C.prototype.truncateRetryButton = function () {
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
  C.prototype.getTitle = function () {
    return H5P.createTitle((this.contentData && this.contentData.metadata && this.contentData.metadata.title) ? this.contentData.metadata.title : 'Dialog Cards');
  };
  C.SCALEINTERVAL = 0.2;
  C.MAXSCALE = 16;
  C.MINSCALE = 4;

  return C;
})(H5P.jQuery, H5P.Audio, H5P.JoubelUI);
