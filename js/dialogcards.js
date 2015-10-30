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
  function C(params, id) {
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
      progressText: "Card @card of @total",
      endComment: "This was the last card. Press Try again to start over.",
      dialogs: []
    }, params);

    self._current = -1;
    self._turned = [];
    self.$images = [];
  }

  C.prototype = Object.create(H5P.EventDispatcher.prototype);
  C.prototype.constructor = C;

  /**
   * Attach h5p inside the given container.
   *
   * @param {jQuery} $container
   */
  C.prototype.attach = function ($container) {
    var self = this;
    self.$inner = $container.append($('' +
      '<div class="h5p-title">' + self.params.title + '</div>' +
      '<div class="h5p-description">' + self.params.description + '</div>'
      ));

    self.createCards(self.params.dialogs)
      .appendTo(self.$inner);

    self.createFooter()
      .appendTo(self.$inner);

    // Add tips
    self.$inner.find('.h5p-card-content').each(function (i) {
      self.addTipToCard($(this), 'front', i);
    });


    self.updateNavigation();

    self.on('reset', function () {
      self.reset();
    });

    $container.addClass('h5p-dialogcards').append(self.$inner);
    self.resize();
  };

  /**
   * Create footer/navigation line
   *
   * @returns {*|jQuery|HTMLElement} Footer element
   */
  C.prototype.createFooter = function () {
    var self = this;
    var $footer = $('<div>', {
      'class': 'h5p-footer'
    });

    self.$prev = JoubelUI.createButton({
      'class': 'h5p-footer-button h5p-prev truncated',
      'title': self.params.prev
    }).click(function () {
      self.prevCard();
    }).appendTo($footer);

    self.$next = JoubelUI.createButton({
      'class': 'h5p-footer-button h5p-next truncated',
      'title': self.params.next
    }).click(function () {
      self.nextCard();
    }).appendTo($footer);

    self.$retry = JoubelUI.createButton({
      'class': 'h5p-footer-button h5p-retry h5p-disabled truncated',
      'title': self.params.retry
    }).click(function () {
      self.trigger('reset');
    }).appendTo($footer);

    self.$progress = $('<div>', {
      'class': 'h5p-progress'
    }).appendTo($footer);

    return $footer
  };

  /**
   * Called when all cards has been loaded.
   */
  C.prototype.updateImageSize = function () {
    var self = this;

    // Find highest card content
    var height = 180;
    var j;
    var foundImage = false;
    for (j = 0; j < self.$images.length; j++) {
      var $image = self.$images[j];

      if ($image === undefined || !$image.is('img')) {
        continue;
      }
      foundImage = true;

      $image.parent().css('height', 'auto');
      var imageHeight = $image.height();
      if (imageHeight > height) {
        height = imageHeight;
      }
    }

    if (foundImage) {
      var relativeImageHeight = height / parseFloat(self.$inner.css('font-size'));
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
    var tips = self.params.dialogs[index].tips;
    if (tips !== undefined && tips[side] !== undefined) {
      var tip = tips[side].trim();
      if (tip.length) {
        $card.find('.h5p-card-text-wrapper').append(JoubelUI.createTip(tip));
      }
    }
  };

  /**
   * Creates all cards and appends them to card wrapper.
   *
   * @param {Array} cards Card parameters
   * @returns {*|jQuery|HTMLElement} Card wrapper set
   */
  C.prototype.createCards = function (cards) {
    var self = this;
    var loaded = 0;

    self.$cardwrapperSet = $('<div>', {
      'class': 'h5p-cardwrap-set'
    });

    var load = function () {
      loaded++;
      if (loaded === self.params.dialogs.length) {
        self.resize();
      }
    };


    for (var i = 0; i < cards.length; i++) {
      var $cardWrapper = self.createCard(cards[i], load);

      // Set current card
      if (i === 0) {
        $cardWrapper.addClass('h5p-current');
        self.$current = $cardWrapper;
      }

      self.$cardwrapperSet.append($cardWrapper);
    }

    return self.$cardwrapperSet;
  };

  /**
   * Create a single card card
   *
   * @param {Object} card Card parameters
   * @param {Function} loadCallback Function to call when loading image
   * @returns {*|jQuery|HTMLElement} Card wrapper
   */
  C.prototype.createCard = function (card, loadCallback) {
    var self = this;
    var $cardWrapper = $('<div>', {
      'class': 'h5p-cardwrap'
    });

    var $cardHolder = $('<div>', {
      'class': 'h5p-cardholder'
    }).appendTo($cardWrapper);

    self.createCardContent(card, loadCallback)
      .appendTo($cardHolder);

    self.createCardFooter()
      .appendTo($cardHolder);

    return $cardWrapper;

  };

  /**
   * Create content for a card
   *
   * @param {Object} card Card parameters
   * @param {Function} loadCallback Function to call when loading image
   * @returns {*|jQuery|HTMLElement} Card content wrapper
   */
  C.prototype.createCardContent = function (card, loadCallback) {
    var self = this;
    var $cardContent = $('<div>', {
      'class': 'h5p-card-content'
    });

    self.createCardImage(card, loadCallback)
      .appendTo($cardContent);

    var $cardTextWrapper = $('<div>', {
      'class': 'h5p-card-text-wrapper'
    }).appendTo($cardContent);

    var $cardTextInner = $('<div>', {
      'class': 'h5p-card-text-inner'
    }).appendTo($cardTextWrapper);

    self.createCardAudio(card)
      .appendTo($cardTextInner);

    $('<div>', {
      'class': 'h5p-card-text',
      'html': card.text
    }).appendTo($cardTextInner);

    if (card.audio || card.text) {
      $cardTextWrapper.addClass('show');
    }

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
      'class': 'h5p-card-footer'
    });

    JoubelUI.createButton({
      'class': 'h5p-turn',
      'html': self.params.answer
    }).click(function () {
      self.turnCard($(this).parents('.h5p-cardwrap'));
    }).appendTo($cardFooter);

    return $cardFooter;
  };

  /**
   * Create card image
   *
   * @param {Object} card Card parameters
   * @param {Function} loadCallback Function to call when loading image
   * @returns {*|jQuery|HTMLElement} Card image wrapper
   */
  C.prototype.createCardImage = function (card, loadCallback) {
    var self = this;
    var $image;
    var $imageWrapper = $('<div>', {
      'class': 'h5p-image-wrapper'
    });

    if (card.image !== undefined) {
      $image = $('<img class="h5p-image" src="' + H5P.getPath(card.image.path, self.id) + '"/>').load(loadCallback);
    }
    else {
      $image = $('<div class="h5p-image"></div>');
      loadCallback();
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
    var $audioWrapper = $('<div>', {
      'class': 'h5p-audio-wrapper'
    });
    if (card.audio !== undefined) {

      var audioDefaults = {
        files: card.audio
      };
      var audio = new Audio(audioDefaults, self.id);
      audio.attach($audioWrapper);
    }
    else {
      $audioWrapper.addClass('hide');
    }

    return $audioWrapper;
  };

  /**
   * Update navigation text and show or hide buttons.
   */
  C.prototype.updateNavigation = function () {
    var self = this;

    if (self.$current.next('.h5p-cardwrap').length) {
      self.$next.removeClass('h5p-disabled');
      self.$retry.addClass('h5p-disabled');
    }
    else {
      self.$next.addClass('h5p-disabled');
      if (self.$current.find('.h5p-turn').hasClass('h5p-disabled')) {
        self.$retry.removeClass('h5p-disabled');
      }
    }

    if (self.$current.prev('.h5p-cardwrap').length) {
      self.$prev.removeClass('h5p-disabled');
    }
    else {
      self.$prev.addClass('h5p-disabled');
    }

    self.$progress.text(self.params.progressText.replace('@card', self.$current.index() + 1).replace('@total', self.params.dialogs.length));
  };

  /**
   * Show next card.
   */
  C.prototype.nextCard = function () {
    var self = this;
    var $next = self.$current.next('.h5p-cardwrap');

    if ($next.length) {
      self.$current.removeClass('h5p-current').addClass('h5p-previous');
      self.$current = $next.addClass('h5p-current');
      self.updateNavigation();
    }
  };

  /**
   * Show previous card.
   */
  C.prototype.prevCard = function () {
    var self = this;
    var $prev = self.$current.prev('.h5p-cardwrap');

    if ($prev.length) {
      self.$current.removeClass('h5p-current');
      self.$current = $prev.addClass('h5p-current').removeClass('h5p-previous');
      self.updateNavigation();
    }
  };

  /**
   * Show the opposite site of the card.
   *
   * @param {jQuery} $card
   */
  C.prototype.turnCard = function ($card) {
    var self = this;
    var $c = $card.find('.h5p-card-content');
    var $ch = $card.find('.h5p-cardholder').addClass('h5p-collapse');

    // Removes tip, since it destroys the animation:
    $c.find('.joubel-tip-container').remove();

    setTimeout(function () {
      $ch.removeClass('h5p-collapse');
      self.removeAudio($ch);
      self.changeText($c, self.params.dialogs[$card.index()].answer);

      // Add backside tip
      // Had to wait a little, if not Chrome will displace tip icon
      setTimeout(function () {
        self.addTipToCard($c, 'back');
        if (!self.$current.next('.h5p-cardwrap').length) {
          $card.find('.h5p-cardholder').append('<div class="h5p-endcomment">' + self.params.endComment + '</div>');
          self.$retry.removeClass('h5p-disabled');
        }
      }, 200);
    }, 200);

    $card.find('.h5p-turn').addClass('h5p-disabled');
  };

  /**
   * Change text of card, used when turning cards.
   *
   * @param $card
   * @param text
   */
  C.prototype.changeText = function ($card, text) {
    $card.find('.h5p-card-text').html(text);
  };

  /**
   * Hide audio button
   *
   * @param $card
   */
  C.prototype.removeAudio = function ($card) {
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
   * Reset the task so that the user can do it again.
   */
  C.prototype.reset = function () {
    var self = this;
    var $cards = self.$inner.find('.h5p-cardwrap');

    self.$current.removeClass('h5p-current');
    self.$current = $cards.filter(':first').addClass('h5p-current');
    self.updateNavigation();

    $cards.each(function (index) {
      var $card = $(this).removeClass('h5p-previous');
      self.changeText($card, self.params.dialogs[$card.index()].text);

      self.addTipToCard($card.find('.h5p-card-content'), 'front', index);
    });
    self.$inner.find('.h5p-turn').removeClass('h5p-disabled');
    self.$inner.find('.h5p-endcomment').remove();
    self.showAllAudio();
  };

  /**
   * Update the dimensions of the task when resizing the task.
   */
  C.prototype.resize = function () {
    var self = this;
    var maxHeight = 0;

    //Find max required height for all cards
    self.$cardwrapperSet.children().each( function () {
      self.updateImageSize();
      var wrapperHeight = $(this).css('height', 'initial').outerHeight();
      $(this).css('height', 'inherit');
      maxHeight = wrapperHeight > maxHeight ? wrapperHeight : maxHeight;

      //Check height with endcomment
      if ((!$(this).next('.h5p-cardwrap').length) && (!$(this).find('.h5p-endcomment')[0])) {
        $(this).find('.h5p-turn').addClass('h5p-disabled');
        $(this).find('.h5p-cardholder').append('<div class="h5p-endcomment">' + self.params.endComment + '</div>');
        var initialHeight = $(this).find('.h5p-cardholder').css('height', 'initial').outerHeight();
        maxHeight = initialHeight > maxHeight ? initialHeight : maxHeight;
        $(this).find('.h5p-cardholder').css('height', 'inherit');
        $(this).find('.h5p-turn').removeClass('h5p-disabled');
        $(this).find('.h5p-endcomment').remove();
      }
    });
    self.$cardwrapperSet.css('height', maxHeight + 'px');
  };

  return C;
})(H5P.jQuery, H5P.Audio, H5P.JoubelUI);
