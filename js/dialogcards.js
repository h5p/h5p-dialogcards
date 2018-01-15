var H5P = H5P || {};

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
   * @returns {C} self
   */
  function C(params, id, contentData) {
    var self = this;
    H5P.EventDispatcher.call(this);

    self.contentId = self.id = id;

    // Set default behavior.
    self.params = $.extend({
      title: "Dialogue",
      description: "Sit in pairs and make up sentences where you include the expressions below.<br/>Example: I should have said yes, HOWEVER I kept my mouth shut.",
      next: "Next",
      prev: "Previous",
      retry: "Retry",
      answer: "Turn",
      randomizeCardsQuestion: "Display the cards in random order?",
      no: "No",
      yes: "Yes",
      numCardsQuestion: "How many cards do you want?",
      allCards: "all",
      gotit: "OK",
      finished: "You have finished. Congratulations!",
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
        randomCards: 'normal',
        maxScore: 1
      }
    }, params);

    self._current = -1;
    self._turned = [];
    self.$images = [];
    self.audios = [];

    // Copy parameters for further use if save content state.
    self.dialogs = self.params.dialogs;
    self.nbCards = self.params.dialogs.length;
    self.randomCards = self.params.behaviour.randomCards;

    // Var cardOrder stores order of cards to allow resuming of card set.
    // Var progress stores current card index.
    this.contentData = contentData || {};
    // Bring card set up to date when resuming.
    if (this.contentData.previousState) {
      this.progress = this.contentData.previousState.progress;
      this.cardOrder = contentData.previousState.order;
      this.taskFinished = (contentData.previousState.taskFinished !== undefined ? contentData.previousState.taskFinished : false);
    }
  }

  C.prototype = Object.create(H5P.EventDispatcher.prototype);
  C.prototype.constructor = C;

  /**
   * Attach the first part of the h5p inside the given container (title and description).
   *
   * @param {jQuery} $container
   */
  C.prototype.attach = function ($container) {
    var self = this;
    self.$inner = $container
      .addClass('h5p-dialogcards')
      .append($('' +
      '<div class="h5p-dialogcards-title"><div class="h5p-dialogcards-title-inner">' + self.params.title + '</div></div>' +
      '<div class="h5p-dialogcards-description">' + self.params.description + '</div>'
      ));

    // If we are resuming task from a previously finished task, ask user it they want to Retry.
    if (this.taskFinished) {
      self.finishedScreen();
      return;
    }
    var existsCardOrder = true;
    if ($.isEmptyObject(this.cardOrder)) {
      existsCardOrder = false;
    }
    // Create cardOrder and cardNumber buttons only on first instanciation for logged in user.
    if (self.params.behaviour.randomCards == 'user' && !existsCardOrder) {
      self.createOrder().appendTo(self.$inner);
    } else {
      self.attachContinue();
    }
  };

  /**
   * Attach the rest of the h5p inside the given container.
   *
   * @param {jQuery} $container
   */
   C.prototype.attachContinue = function ($container) {
    var self = this;

    // Remove potential user interaction elements from DOM.
    $( '.h5p-dialogcards-number', self.$inner ).remove();

    if (self.params.behaviour.scaleTextNotCard) {
      self.$inner.addClass('h5p-text-scaling');
    }

    self.initCards(self.dialogs)
      .appendTo(self.$inner);

    self.$cardSideAnnouncer = $('<div>', {
      html: self.params.cardFrontLabel,
      'class': 'h5p-dialogcards-card-side-announcer',
      'aria-live': 'polite',
      'aria-hidden': 'true'
    }).appendTo(self.$inner);

    self.createFooter()
      .appendTo(self.$inner);

    self.updateNavigation();

    self.on('retry', function () {
      self.retry();
    });

    self.on('resetTask', function () {
      self.resetTask();
    });

    self.on('resize', self.resize);
    self.trigger('resize');
  };


  /**
   * Create orderCards option request
   *
   * @returns {*|jQuery|HTMLElement} Order element
   */
  C.prototype.createOrder = function () {
    var self = this;
    var $order = $('<div>', {
      'class': 'h5p-dialogcards-order',
      'html': self.params.randomizeCardsQuestion
    });

    self.$normalOrder = JoubelUI.createButton({
      'class': 'h5p-dialogcards-order-button',
      'title': self.params.no,
      'html': self.params.no
    }).click(function () {
      self.randomizeOrder("normal");
    }).appendTo($order);

    self.$randomizeOrder = JoubelUI.createButton({
      'class': 'h5p-dialogcards-order-button',
      'title': self.params.yes,
      'html': self.params.yes
    }).click(function () {
      self.randomizeOrder("random");
    }).appendTo($order);

    return $order;
  };


  /**
   * Create numberCards option request
   *
   * @returns {*|jQuery|HTMLElement} numberCards element
   */
  C.prototype.createNumberCards = function () {
    var self = this;

    var numCards = self.params.dialogs.length;

    var $numberCards = $('<div>', {
      'class': 'h5p-dialogcards-number',
      'style': 'height:200px;',
      'html': self.params.numCardsQuestion + "<br /><br />"
    });

    // Allow user to select a number of cards to play with, by displaying selectable buttons in increments of 5.
    for (var i = 5; i < numCards; i+= 5) {
      self.$button = JoubelUI.createButton({
          'class': 'h5p-dialogcards-number-button',
          'title': i,
          'html': i,
          'id': 'dc-number-' + i
        }).click(function () {
            self.nbCards = this.title;
            self.attachContinue();
          }).appendTo($numberCards);
      };

      self.$button = JoubelUI.createButton({
        'class': 'h5p-dialogcards-number-button',
        'title': numCards,
        'html': self.params.allCards + " (" + numCards + ")"
        }).click(function () {
          self.nbCards = numCards;
          self.attachContinue();
        }).appendTo($numberCards);

    return $numberCards;
  };


  /**
   * Create footer/navigation line
   *
   * @returns {*|jQuery|HTMLElement} Footer element
   */
  C.prototype.createFooter = function () {
    var self = this;
    var $footer = $('<nav>', {
      'class': 'h5p-dialogcards-footer',
      'role': 'navigation'
    });

    self.$prev = JoubelUI.createButton({
      'class': 'h5p-dialogcards-footer-button h5p-dialogcards-prev truncated',
      'title': self.params.prev
    }).click(function () {
      self.prevCard();
    }).appendTo($footer);

    self.$next = JoubelUI.createButton({
      'class': 'h5p-dialogcards-footer-button h5p-dialogcards-next truncated',
      'title': self.params.next
    }).click(function () {
      self.nextCard();
    }).appendTo($footer);

    self.$retry = JoubelUI.createButton({
      'class': 'h5p-dialogcards-footer-button h5p-dialogcards-retry h5p-dialogcards-disabled',
      'title': self.params.retry,
      'html': self.params.retry
    }).click(function () {
      self.trigger('retry');
    }).appendTo($footer);

    self.$progress = $('<div>', {
      'class': 'h5p-dialogcards-progress',
      'aria-live': 'assertive'
    }).appendTo($footer);

    return $footer;
  };

  /**
   * Called when all cards have been loaded.
   */
  C.prototype.updateImageSize = function () {
    var self = this;

    // Find highest card content
    var relativeHeightCap = 15;
    var height = 0;
    var i;
    var foundImage = false;
    for (i = 0; i < self.dialogs.length; i++) {
      var card = self.dialogs[i];
      var $card = self.$current.find('.h5p-dialogcards-card-content');

      if (card.image === undefined) {
        continue;
      }
      foundImage = true;
      var imageHeight = card.image.height / card.image.width * $card.get(0).getBoundingClientRect().width;

      if (imageHeight > height) {
        height = imageHeight;
      }
    }

    if (foundImage) {
      var relativeImageHeight = height / parseFloat(self.$inner.css('font-size'));
      if (relativeImageHeight > relativeHeightCap) {
        relativeImageHeight = relativeHeightCap;
      }
      self.$images.forEach(function ($img) {
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
  C.prototype.addTipToCard = function($card, side, index) {
    var self = this;

    // Make sure we have a side
    if (side !== 'back') {
      side = 'front';
    }

    // Make sure we have an index

    if (index === undefined) {
      index = self.$current.index();
    }

    // Remove any old tips
    $card.find('.joubel-tip-container').remove();

    // Add new tip if set and has length after trim
    var tips = self.dialogs[index].tips;
    if (tips !== undefined && tips[side] !== undefined) {
      var tip = tips[side].trim();
      if (tip.length) {
        $card.find('.h5p-dialogcards-card-text-wrapper .h5p-dialogcards-card-text-inner')
          .after(JoubelUI.createTip(tip, {
            tipLabel: self.params.tipButtonLabel
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
    var self = this;
    var loaded = 0;
    var existsCardOrder = true;
    if ($.isEmptyObject(this.cardOrder)) {
      existsCardOrder = false;
    }
    var initLoad = self.nbCards;

    // If keepstate only randomize first instanciation.
    var okForRandomize = false;
    if (this.contentData.previousState === undefined || this.contentData.previousState.order === undefined) {
      okForRandomize = true;
    }

    if ( (self.randomCards == 'normal' || self.randomCards == 'random') && !existsCardOrder) {
      var cardOrdering = cards.map(function(cards, index) { return [cards, index] });
      // Shuffle the multidimensional array IF 'random' only.
      if (self.randomCards === 'random') {
        cardOrdering = H5P.shuffleArray(cardOrdering);
      }

      // Retrieve cards objects from the first index
      var randomCards = [];
      for (var i = 0; i < self.nbCards; i++) {
        randomCards[i] = cardOrdering[i][0];
      }

      // Retrieve the new shuffled order from the second index
      var newOrder = [];
      for (var i = 0; i< self.nbCards; i++) {
          newOrder[i] = cardOrdering[i][1];
      }
      this.cardOrder = newOrder;

      cards = randomCards;
    }

    // Use a previous order if it exists.
    if (this.contentData.previousState) {
      if (this.contentData.previousState.order && existsCardOrder) {
        this.cardOrder.splice(cards.length,this.cardOrder.length);
        previousOrder = this.contentData.previousState.order;
        var cardOrdering = cards.map(function(cards, index) { return [cards, index] });
        var newCards = [];
        for (var i = 0; i< previousOrder.length; i++) {
          newCards[i] = cardOrdering[previousOrder[i]][0];
        }
        cards = newCards;
      }
    }

    // Push the new 'cards array' into self.dialogs.
    self.dialogs = cards;
    self.getCurrentState = function () {
      return {
        progress: self.$current.index(),
        order: self.cardOrder,
        taskFinished: self.taskFinished
      };
    };

    self.$cardwrapperSet = $('<div>', {
      'class': 'h5p-dialogcards-cardwrap-set'
    });

    var setCardSizeCallback = function () {
      loaded++;
      if (loaded === initLoad) {
        self.resize();
      }
    };


    for (var i = 0; i < cards.length; i++) {

      // Load cards progressively
      // This feature has been removed because when the "gotit" feature is enabled we must load ALL cards at once.

      // Set current card index
      // If there is a saved state, then set current card index to saved position (progress)
      // otherwise set it to zero.
      var $cardWrapper = self.createCard(cards[i], i, setCardSizeCallback);
      if (((this.progress == undefined || this.progress == -1) && i === 0) || (this.progress !== undefined && i == this.progress)) {

        $cardWrapper.addClass('h5p-dialogcards-current');
        self.$current = $cardWrapper;
      }

      // Only way I found to avoid jitter when resuming.
      if (this.progress !== undefined && i < this.progress) {
        $cardWrapper.addClass('h5p-dialogcards-previous');
      }

      self.addTipToCard($cardWrapper.find('.h5p-dialogcards-card-content'), 'front', i);

      self.$cardwrapperSet.append($cardWrapper);
    }

    return self.$cardwrapperSet;
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
    var self = this;
    var $cardWrapper = $('<div>', {
      'class': 'h5p-dialogcards-cardwrap'
    });

    var $cardHolder = $('<div>', {
      'class': 'h5p-dialogcards-cardholder'
    }).appendTo($cardWrapper);

    // Progress for assistive technologies
    var progressText = self.params.progressText
      .replace('@card', (cardNumber + 1).toString())
      .replace('@total', (self.params.dialogs.length).toString());

    $('<div>', {
      'class': 'h5p-dialogcards-at-progress',
      'text': progressText
    }).appendTo($cardHolder);

    self.createCardContent(card, cardNumber, setCardSizeCallback)
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
    var self = this;
    var $cardContent = $('<div>', {
      'class': 'h5p-dialogcards-card-content'
    });


    self.createCardImage(card, setCardSizeCallback)
      .appendTo($cardContent);

    var $cardTextWrapper = $('<div>', {
      'class': 'h5p-dialogcards-card-text-wrapper'
    }).appendTo($cardContent);

    var $cardTextInner = $('<div>', {
      'class': 'h5p-dialogcards-card-text-inner'
    }).appendTo($cardTextWrapper);

    var $cardTextInnerContent = $('<div>', {
      'class': 'h5p-dialogcards-card-text-inner-content'
    }).appendTo($cardTextInner);

    self.createCardAudio(card)
      .appendTo($cardTextInnerContent);

    var $cardText = $('<div>', {
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

    self.createCardFooter()
      .appendTo($cardTextWrapper);

    return $cardContent;
  };

  /**
   * Create card footer
   *
   * @returns {*|jQuery|HTMLElement} Card footer element
   */
  C.prototype.createCardFooter = function () {
    var self = this;
    var $cardFooter = $('<div>', {
      'class': 'h5p-dialogcards-card-footer'
    });

    JoubelUI.createButton({
      'class': 'h5p-dialogcards-turn',
      'html': self.params.answer
    }).click(function () {
      self.turnCard($(this).parents('.h5p-dialogcards-cardwrap'));
    }).appendTo($cardFooter);

    JoubelUI.createButton({
      'class': 'h5p-dialogcards-gotit truncated h5p-dialogcards-disabled',
      'title': self.params.gotit
    }).click(function () {
      self.gotIt($(this).parents('.h5p-dialogcards-cardwrap'));
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
    var self = this;
    var $image;
    var $imageWrapper = $('<div>', {
      'class': 'h5p-dialogcards-image-wrapper'
    });

    if (card.image !== undefined) {
      $image = $('<img class="h5p-dialogcards-image" src="' + H5P.getPath(card.image.path, self.id) + '"/>');
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
    self.$images.push($image);
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
    var self = this;
    var audio;
    var $audioWrapper = $('<div>', {
      'class': 'h5p-dialogcards-audio-wrapper'
    });
    if (card.audio !== undefined) {

      var audioDefaults = {
        files: card.audio,
        audioNotSupported: self.params.audioNotSupported
      };

      audio = new Audio(audioDefaults, self.id);
      audio.attach($audioWrapper);

      // Have to stop else audio will take up a socket pending forever in chrome.
      if (audio.audio && audio.audio.preload) {
        audio.audio.preload = 'none';
      }
    }
    else {
      $audioWrapper.addClass('hide');
    }
    self.audios.push(audio);

    return $audioWrapper;
  };

  /**
   * Update navigation text and show or hide buttons.
   */
  C.prototype.updateNavigation = function () {
    var self = this;

    if (self.$current.next('.h5p-dialogcards-cardwrap').length) {
      self.$next.removeClass('h5p-dialogcards-disabled');
      self.$retry.addClass('h5p-dialogcards-disabled');
    }
    else {
      self.$next.addClass('h5p-dialogcards-disabled');
    }

    if (self.$current.prev('.h5p-dialogcards-cardwrap').length && !self.params.behaviour.disableBackwardsNavigation) {
      self.$prev.removeClass('h5p-dialogcards-disabled');
    }
    else {
      self.$prev.addClass('h5p-dialogcards-disabled');
    }

    self.$progress.text(self.params.progressText.replace('@card', self.$current.index() + 1).replace('@total', self.dialogs.length));
    self.resizeOverflowingText();
  };

  /**
   * Show next card.
   */
  C.prototype.nextCard = function () {
    var self = this;
    var $next = self.$current.next('.h5p-dialogcards-cardwrap');

    // End of cards reached.
    if ($next.length) {
      self.stopAudio(self.$current.index());
      self.$current.removeClass('h5p-dialogcards-current').addClass('h5p-dialogcards-previous');
      self.$current = $next.addClass('h5p-dialogcards-current');
      self.setCardFocus(self.$current);
      // Add next card no longer needed when ALL cards are loaded at once.
      self.turnCardToFront();
      // Update navigation
      self.updateNavigation();
    }
  };

  /**
   * Show previous card.
   */
  C.prototype.prevCard = function () {
    var self = this;
    var $prev = self.$current.prev('.h5p-dialogcards-cardwrap');

    if ($prev.length) {
      self.stopAudio(self.$current.index());
      self.$current.removeClass('h5p-dialogcards-current');
      self.$current = $prev.addClass('h5p-dialogcards-current').removeClass('h5p-dialogcards-previous');
      self.setCardFocus(self.$current);
      self.turnCardToFront();
      self.updateNavigation();
    }
  };

  /**
   * User selected cards order option (normal/random).
   */
  C.prototype.randomizeOrder = function (cardsOrder) {
    var self = this;
    self.randomCards = cardsOrder;
    $( '.h5p-dialogcards-order', self.$inner ).remove();
    if (cardsOrder === 'random') {
      self.createNumberCards()
        .appendTo(self.$inner);
    } else {
      self.attachContinue();
    }

  };

  /**
   * When navigating forward or backward, reset card to front view if has previously been turned
   * so that user can see the Question side, not the Answer side of the card.
   */
  C.prototype.turnCardToFront = function () {
    var self = this;
    var $c = self.$current.find('.h5p-dialogcards-card-content');
    var turned = $c.hasClass('h5p-dialogcards-turned');
    if (turned) {
      self.turnCard(self.$current);
      var $cg = self.$current.find('.h5p-dialogcards-gotit');
      $cg.addClass('h5p-dialogcards-disabled');
    }
  }

  /**
   * Show the opposite site of the card.
   *
   * @param {jQuery} $card
   */
  C.prototype.turnCard = function ($card) {
    var self = this;
    var $c = $card.find('.h5p-dialogcards-card-content');
    var $ch = $card.find('.h5p-dialogcards-cardholder').addClass('h5p-dialogcards-collapse');
    var $cg = $card.find('.h5p-dialogcards-gotit');

    // Removes tip, since it destroys the animation:
    $c.find('.joubel-tip-container').remove();

    // Check if card has been turned before
    var turned = $c.hasClass('h5p-dialogcards-turned');
    self.$cardSideAnnouncer.html(turned ? self.params.cardFrontLabel : self.params.cardBackLabel);

    // Update HTML class for card
    $c.toggleClass('h5p-dialogcards-turned', !turned);

    setTimeout(function () {
      $ch.removeClass('h5p-dialogcards-collapse');
      self.changeText($c, self.dialogs[$card.index()][turned ? 'text' : 'answer']);
      if (turned) {
        $ch.find('.h5p-audio-inner').removeClass('hide');
        $cg.addClass('h5p-dialogcards-disabled');
      }
      else {
        self.removeAudio($ch);
        $cg.removeClass('h5p-dialogcards-disabled');
      }

      // Add backside tip
      // Had to wait a little, if not Chrome will displace tip icon
      setTimeout(function () {
        self.addTipToCard($c, turned ? 'front' : 'back');
        if (!self.$current.next('.h5p-dialogcards-cardwrap').length && self.dialogs.length > 1) {
          if (self.params.behaviour.enableRetry) {
            self.$retry.removeClass('h5p-dialogcards-disabled');
            self.truncateRetryButton();
            self.resizeOverflowingText();
          }
        }
      }, 200);

      self.resizeOverflowingText();

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
    var $cardText = $card.find('.h5p-dialogcards-card-text-area');
    $cardText.html(text);
    $cardText.toggleClass('hide', (!text || !text.length));
  };

  /**
   * Stop audio of card with cardindex

   * @param {Number} cardIndex Index of card
   */
  C.prototype.stopAudio = function (cardIndex) {
    var self = this;
    var audio = self.audios[cardIndex];
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
    var self = this;
    self.stopAudio($card.closest('.h5p-dialogcards-cardwrap').index());
    $card.find('.h5p-audio-inner')
      .addClass('hide');
  };

  /**
   * Show all audio buttons
   */
  C.prototype.showAllAudio = function () {
    var self = this;
    self.$cardwrapperSet.find('.h5p-audio-inner')
      .removeClass('hide');
  };

  /**
   * Reset the task so that the user can re-start from first card.
   */
  C.prototype.retry = function () {
    var self = this;
    var $cards = self.$inner.find('.h5p-dialogcards-cardwrap');

    self.stopAudio(self.$current.index());
    self.$current.removeClass('h5p-dialogcards-current');
    self.$current = $cards.filter(':first').addClass('h5p-dialogcards-current');
    self.updateNavigation();

    $cards.each(function (index) {
      var $card = $(this).removeClass('h5p-dialogcards-previous');
      self.changeText($card, self.dialogs[$card.index()].text);
      var $cardContent = $card.find('.h5p-dialogcards-card-content');
      $cardContent.removeClass('h5p-dialogcards-turned');
      self.addTipToCard($cardContent, 'front', index);
      var $cg = $card.find('.h5p-dialogcards-gotit');
      $cg.addClass('h5p-dialogcards-disabled');
    });
    self.$retry.addClass('h5p-dialogcards-disabled');
    self.showAllAudio();
    self.resizeOverflowingText();
    self.setCardFocus(self.$current);
  };

  /**
   * Update the dimensions of the task when resizing the task.
   */
  C.prototype.resize = function () {
    var self = this;
    var maxHeight = 0;
    self.updateImageSize();
    if (!self.params.behaviour.scaleTextNotCard) {
      self.determineCardSizes();
    }

    // Reset card-wrapper-set height
    self.$cardwrapperSet.css('height', 'auto');

    //Find max required height for all cards
    self.$cardwrapperSet.children().each( function () {
      var wrapperHeight = $(this).css('height', 'initial').outerHeight();
      $(this).css('height', 'inherit');
      maxHeight = wrapperHeight > maxHeight ? wrapperHeight : maxHeight;

      // Check height
      if (!$(this).next('.h5p-dialogcards-cardwrap').length) {
        var initialHeight = $(this).find('.h5p-dialogcards-cardholder').css('height', 'initial').outerHeight();
        maxHeight = initialHeight > maxHeight ? initialHeight : maxHeight;
        $(this).find('.h5p-dialogcards-cardholder').css('height', 'inherit');
      }
    });
    var relativeMaxHeight = maxHeight / parseFloat(self.$cardwrapperSet.css('font-size'));
    self.$cardwrapperSet.css('height', relativeMaxHeight + 'em');
    self.scaleToFitHeight();
    self.truncateRetryButton();
    self.resizeOverflowingText();
  };

  /**
   * Resizes each card to fit its text
   */
  C.prototype.determineCardSizes = function () {
    var self = this;

    if (self.cardSizeDetermined === undefined) {
      // Keep track of which cards we've already determined size for
      self.cardSizeDetermined = [];
    }

    // Go through each card
    self.$cardwrapperSet.children(':visible').each(function (i) {
      if (self.cardSizeDetermined.indexOf(i) !== -1) {
        return; // Already determined, no need to determine again.
      }
      self.cardSizeDetermined.push(i);

      var $content = $('.h5p-dialogcards-card-content', this);
      var $text = $('.h5p-dialogcards-card-text-inner-content', $content);

      // Grab size with text
      var textHeight = $text[0].getBoundingClientRect().height;

      // Change to answer
      self.changeText($content, self.dialogs[i].answer);

      // Grab size with answer
      var answerHeight = $text[0].getBoundingClientRect().height;

      // Use highest
      var useHeight = (textHeight > answerHeight ? textHeight : answerHeight);

      // Min. limit
      var minHeight = parseFloat($text.parent().parent().css('minHeight'));
      if (useHeight < minHeight) {
        useHeight =  minHeight;
      }

      // Convert to em
      var fontSize = parseFloat($content.css('fontSize'));
      useHeight /= fontSize;

      // Set height
      $text.parent().css('height', useHeight + 'em');

      // Change back to text
      self.changeText($content, self.dialogs[i].text);
    });
  };

  C.prototype.scaleToFitHeight = function () {
    var self = this;
    if (!self.$cardwrapperSet || !self.$cardwrapperSet.is(':visible') || !self.params.behaviour.scaleTextNotCard) {
      return;
    }

    // Resize font size to fit inside CP
    if (self.$inner.parents('.h5p-course-presentation').length) {
      var $parentContainer = self.$inner.parent();
      if (self.$inner.parents('.h5p-popup-container').length) {
        $parentContainer = self.$inner.parents('.h5p-popup-container');
      }
      var containerHeight = $parentContainer.get(0).getBoundingClientRect().height;
      var getContentHeight = function () {
        var contentHeight = 0;
        self.$inner.children().each(function () {
          contentHeight += $(this).get(0).getBoundingClientRect().height +
          parseFloat($(this).css('margin-top')) + parseFloat($(this).css('margin-bottom'));
        });
        return contentHeight;
      };
      var contentHeight = getContentHeight();
      var parentFontSize = parseFloat(self.$inner.parent().css('font-size'));
      var newFontSize = parseFloat(self.$inner.css('font-size'));

      // Decrease font size
      if (containerHeight < contentHeight) {
        while (containerHeight < contentHeight) {
          newFontSize -= C.SCALEINTERVAL;

          // Cap at min font size
          if (newFontSize < C.MINSCALE) {
            break;
          }

          // Set relative font size to scale with full screen.
          self.$inner.css('font-size', (newFontSize / parentFontSize) + 'em');
          contentHeight = getContentHeight();
        }
      }
      else { // Increase font size
        var increaseFontSize = true;
        while (increaseFontSize) {
          newFontSize += C.SCALEINTERVAL;

          // Cap max font size
          if (newFontSize > C.MAXSCALE) {
            increaseFontSize = false;
            break;
          }

          // Set relative font size to scale with full screen.
          var relativeFontSize = newFontSize / parentFontSize;
          self.$inner.css('font-size', relativeFontSize + 'em');
          contentHeight = getContentHeight();
          if (containerHeight <= contentHeight) {
            increaseFontSize = false;
            relativeFontSize = (newFontSize - C.SCALEINTERVAL) / parentFontSize;
            self.$inner.css('font-size', relativeFontSize + 'em');
          }
        }
      }
    }
    else { // Resize mobile view
      self.resizeOverflowingText();
    }
  };

  /**
   * Resize the font-size of text areas that tend to overflow when dialog cards
   * is squeezed into a tiny container.
   */
  C.prototype.resizeOverflowingText = function () {
    var self = this;

    if (!self.params.behaviour.scaleTextNotCard) {
      return; // No text scaling today
    }

    // Resize card text if needed
    var $textContainer = self.$current.find('.h5p-dialogcards-card-text');
    var $text = $textContainer.children();
    self.resizeTextToFitContainer($textContainer, $text);
  };

  /**
   * Increase or decrease font size so text wil fit inside container.
   *
   * @param {jQuery} $textContainer Outer container, must have a set size.
   * @param {jQuery} $text Inner text container
   */
  C.prototype.resizeTextToFitContainer = function ($textContainer, $text) {
    var self = this;

    // Reset text size
    $text.css('font-size', '');

    // Measure container and text height
    var currentTextContainerHeight = $textContainer.get(0).getBoundingClientRect().height;
    var currentTextHeight = $text.get(0).getBoundingClientRect().height;
    var parentFontSize = parseFloat($textContainer.css('font-size'));
    var fontSize = parseFloat($text.css('font-size'));
    var mainFontSize = parseFloat(self.$inner.css('font-size'));

    // Decrease font size
    if (currentTextHeight > currentTextContainerHeight) {
      var decreaseFontSize = true;
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
      var increaseFontSize = true;
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
    var self = this;
    if (!self.$retry) {
      return;
    }

    // Reset button to full size
    self.$retry.removeClass('truncated');
    self.$retry.html(self.params.retry);

    // Measure button
    var maxWidthPercentages = 0.3;
    var retryWidth = self.$retry.get(0).getBoundingClientRect().width +
        parseFloat(self.$retry.css('margin-left')) + parseFloat(self.$retry.css('margin-right'));
    var retryWidthPercentage = retryWidth / self.$retry.parent().get(0).getBoundingClientRect().width;

    // Truncate button
    if (retryWidthPercentage > maxWidthPercentages) {
      self.$retry.addClass('truncated');
      self.$retry.html('');
    }
  };

  /**
   * Task is finished.
   */

  C.prototype.finishedScreen = function () {
    var self = this;
    self.taskFinished = true;
    self.answered = true;
    self.progress = -1;
    maxScore = self.params.behaviour.maxScore;
    self.triggerXAPIScored(maxScore, maxScore, 'completed');
    self.triggerXAPI('answered');

    // Remove all these elements.
    $('.h5p-dialogcards-cardwrap-set, .h5p-dialogcards-footer', self.$inner).remove();

    // Display task finished feedback message.

    var $feedback = $('<div>', {
      'class': 'h5p-question-feedback-container'
    }).appendTo(self.$inner);

    // Feedback text
    $('<div>', {
      'class': 'h5p-dialogcards-feedback',
      'html': self.params.finished
    }).appendTo($feedback);

    scoreBar = JoubelUI.createScoreBar(maxScore);
    scoreBar.setScore(maxScore);
    scoreBar.appendTo($feedback);

    // Display reset button to enable user to do the task again.
    self.$resetTaskButton = JoubelUI.createButton({
      'class': 'h5p-dialogcards-reset',
      'title': self.params.retry,
      'html': self.params.retry
    }).click(function () {
      self.resetTask();
    }).appendTo(self.$inner);
  }


  /**
   * Remove card from DOM and from cards stack after user has checked the "gotit" button.
   */

  C.prototype.gotIt = function ($card) {
    var self = this;
    self.triggerXAPI('interacted');
    var index = $card.index();

    // Mark current card with a 'gotitdone' class.
    self.$current.addClass('h5p-dialogcards-gotitdone');

    // Move to next card if exists.
    var $nextCard = self.$current.next('.h5p-dialogcards-cardwrap');
    var $prevCard = self.$current.prev('.h5p-dialogcards-cardwrap');

    if ($nextCard.length) {
        var i = 1;
        self.nextCard(i);
    } else if ($prevCard.length) { // No next card left - go to previous.
        self.prevCard();
    } else { // No cards left: task is finished.
        self.finishedScreen();
        return;
    }

    // Now remove the current 'gotitdone' card from the cards and cardOrder arrays.
      self.dialogs.splice(index, 1);
      self.cardOrder.splice(index, 1);

    // Remove the 'gotitdone' card from DOM
      $( '.h5p-dialogcards-gotitdone', self.$inner).remove();

      // Update navigation
      self.updateNavigation();

  };

    /**
   * Resets the task.
   * Used in contracts.
   */

  C.prototype.resetTask = function () {
    self = this;
    self.answered = false;
    // Removes all these elements to start afresh.
    $('.h5p-dialogcards-cardwrap-set, .h5p-dialogcards-footer, .h5p-question-feedback-container, .h5p-dialogcards-reset, .h5p-dialogcards-order', self.$inner).remove();

    // Reset various parameters.
    self.taskFinished = false;
    self.dialogs = self.params.dialogs;
    self.nbCards = self.params.dialogs.length;
    self.cardOrder = -1;
    self.randomCards = self.params.behaviour.randomCards;
    self.cardSizeDetermined = [];

    if (self.params.behaviour.randomCards == 'user') {
      self.createOrder().appendTo(self.$inner);
    } else {
      self.attachContinue();
    }

  };

    /**
   * Does nothing but necessary for the Course Presentation content.
   * Used in contracts.
   * @public
   */

  C.prototype.showSolutions = function () {
    return;
  };

    /**
   * Get maximum score.
   *
   * @returns {Number} Max points
   */
  C.prototype.getMaxScore = function () {
    return this.params.behaviour.maxScore;
  };

  /**
   * @returns {Number} Points.
   */
  C.prototype.getScore = function () {
    if (this.taskFinished) {
      return this.params.behaviour.maxScore;
    } else {
      return 0;
    }
  };

  // Used when a dialog cards activity is included in a Course Presentation content.
  C.prototype.getAnswerGiven = function () {
    return this.answered;
};

  C.SCALEINTERVAL = 0.2;
  C.MAXSCALE = 16;
  C.MINSCALE = 4;

  return C;
})(H5P.jQuery, H5P.Audio, H5P.JoubelUI);
