var H5P = H5P || {};

/**
 * Dialogcards module
 *
 * @param {jQuery} $
 */
H5P.Dialogcards = (function ($) {

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
    }, params);

    self._current = -1;
    self._turned = [];
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

    self._$inner = $container.addClass('h5p-dialogcards').html('\
      <div class="h5p-title">' + self.params.title + '</div>\
      <div class="h5p-description">' + self.params.description + '</div>\
      <div class="h5p-cardwrap-set">'
      + C.createCards(self.params.dialogs, self.params.answer) + '\
      </div>\
      <div class="h5p-inner">\
        <div class="h5p-button h5p-prev" role="button" tabindex="1" title="' + self.params.prev + '"></div>\
        <div class="h5p-button h5p-next" role="button" tabindex="1" title="' + self.params.next + '"></div>\
        <div class="h5p-button h5p-retry h5p-disabled" role="button" tabindex="1">' + self.params.retry + '</div>\
        <div class="h5p-progress"></div>\
      </div>');

    self._$inner.find('.h5p-card').each(function (i) {
      var $this = $(this);
      self.alignText($this);

      // Add tip:
      self.addTipToCard($this, 'front', i);
    });

    self._$cardwrapperSet = self._$inner.find('.h5p-cardwrap-set');
    self._$progress = self._$inner.find('.h5p-progress');
    self._$current = self._$inner.find('.h5p-current');

    self._$inner.find('.h5p-turn').click(function () {
      self.turnCard($(this).parent().parent());
    });

    self._$prev = self._$inner.find('.h5p-prev').click(function () {
      self.prevCard();
    });

    self._$next = self._$inner.find('.h5p-next').click(function () {
      self.nextCard();
    });

    self._$retry = self._$inner.find('.h5p-retry').click(function () {
      self.trigger('reset');
    });

    self.updateNavigation();
    
    self.on('reset', function () {
      self.reset();
    });

    self.resize();
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
      index = $card.parent().parent().index();
    }

    // Remove any old tips
    $card.find('.joubel-tip-container').remove();

    // Add new tip if set and has length after trim
    var tips = self.params.dialogs[index].tips;
    if (tips !== undefined && tips[side] !== undefined) {
      var tip = tips[side].trim();
      if (tip.length) {
        $card.append(H5P.JoubelUI.createTip(tip));
      }
    }
  };

  /**
   * Creates html for all the cards.
   * Uses a table to center text vertically.
   *
   * @param {Array} cards
   * @param {String} turn button text
   */
  C.createCards = function (cards, turn) {
    var html = '';
    for (var i = 0; i < cards.length; i++) {
      html += '\
        <div class="h5p-cardwrap' + (i === 0 ? ' h5p-current' : '') + '">\
          <div class="h5p-cardholder">\
            <div class="h5p-card"><table><tr><td>' + cards[i].text + '</td></tr></table></div>\
            <div class="h5p-button h5p-turn" role="button">' + turn + '</div>\
          </div>\
        </div>';
    }
    return html;
  };

  /**
   * Update navigation text and show or hide buttons.
   */
  C.prototype.updateNavigation = function () {
    var self = this;

    if (self._$current.next('.h5p-cardwrap').length) {
      self._$next.removeClass('h5p-disabled');
      self._$retry.addClass('h5p-disabled');
    }
    else {
      self._$next.addClass('h5p-disabled');
      if (self._$current.find('.h5p-turn').hasClass('h5p-disabled')) {
        self._$retry.removeClass('h5p-disabled');
      }
    }

    if (self._$current.prev('.h5p-cardwrap').length) {
      self._$prev.removeClass('h5p-disabled');
    }
    else {
      self._$prev.addClass('h5p-disabled');
    }

    self._$progress.text(self.params.progressText.replace('@card', self._$current.index() + 1).replace('@total', self.params.dialogs.length));
  };

  /**
   * Show next card.
   */
  C.prototype.nextCard = function () {
    var self = this;
    var $next = self._$current.next('.h5p-cardwrap');

    if ($next.length) {
      self._$current.removeClass('h5p-current').addClass('h5p-previous');
      self._$current = $next.addClass('h5p-current');
      self.updateNavigation();
    }
  };

  /**
   * Show previous card.
   */
  C.prototype.prevCard = function () {
    var self = this;
    var $prev = self._$current.prev('.h5p-cardwrap');

    if ($prev.length) {
      self._$current.removeClass('h5p-current');
      self._$current = $prev.addClass('h5p-current').removeClass('h5p-previous');
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
    var $c = $card.find('.h5p-card');
    var $ch = $card.find('.h5p-cardholder').addClass('h5p-collapse');

    // Removes tip, since it destroys the animation:
    $c.find('.joubel-tip-container').remove();

    setTimeout(function () {
      $ch.removeClass('h5p-collapse');
      self.alignText($c, self.params.dialogs[$card.index()].answer);

      // Add backside tip
      // Had to wait a little, if not Chrome will displace tip icon
      setTimeout(function () {
        self.addTipToCard($c, 'back');
        if (!self._$current.next('.h5p-cardwrap').length) {
          $card.find('.h5p-cardholder').append('<div class="h5p-endcomment">' + self.params.endComment + '</div>');
          self._$retry.removeClass('h5p-disabled');
        }
      }, 300);
    }, 200);

    $card.find('.h5p-turn').addClass('h5p-disabled');
  };

  /**
   * Use a table to vertically align text in the middle.
   * Aligns text to the left if it's multiple lines.
   *
   * @param {jQuery} $card
   * @param {String} text
   */
  C.prototype.alignText = function ($card, text) {
    var self = this;
    var $t = $card.find('table');
    var $td = $t.find('td');

    if (self._oneLineHeight === undefined) {
      if (text === undefined) {
        text = $td.html();
      }
      $td.text('M'); // Test char.
      self._oneLineHeight = $t.height();
    }

    if (text !== undefined) {
      $td.html(text);
    }
    $t.css('height', '');
    if ($t.height() > self._oneLineHeight) {
      $td.addClass('h5p-left');
    }
    else {
      $td.removeClass('h5p-left');
    }

    if (self._cardHeight === undefined) {
      self._cardHeight = $t.parent().height();
    }
    $t.css('height', self._cardHeight + 'px');
  };

  /**
   * Reset the task so that the user can do it again.
   */
  C.prototype.reset = function () {
    var self = this;
    var $cards = self._$inner.find('.h5p-cardwrap');

    self._$current.removeClass('h5p-current');
    self._$current = $cards.filter(':first').addClass('h5p-current');
    self.updateNavigation();

    $cards.each(function (index) {
      var $card = $(this).removeClass('h5p-previous');
      self.alignText($card, self.params.dialogs[$card.index()].text);

      self.addTipToCard($card.find('.h5p-card'), 'front', index);
    });
    self._$inner.find('.h5p-turn').removeClass('h5p-disabled');
    self._$inner.find('.h5p-endcomment').remove();
  };

  /**
   * Update the dimensions of the task when resizing the task.
   */
  C.prototype.resize = function () {
    var self = this;
    var maxHeight = 0;

    //Find max required height for all cards
    self._$cardwrapperSet.children().each( function (cardWrapper) {
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
    self._$cardwrapperSet.css('height', maxHeight + 'px');
  };

  return C;
})(H5P.jQuery);
