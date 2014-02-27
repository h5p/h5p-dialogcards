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
   * @returns {_L8.C}
   */
  function C(params, id) {
    this.id = id;

    // Set default behavior.
    this.params = $.extend({
      title: "Dialogue",
      description: "Sit in pairs and make up sentences where you include the expressions below.<br/>Example: I should have said yes, HOWEVER I kept my mouth shut.",
      next: "Next",
      prev: "Previous",
      answer: "Turn",
      progressText: "Card @card of @total",
      endComment: "This was the last card. Press Try again to start over.",
      postUserStatistics: (H5P.postUserStatistics === true)
    }, params);
    
    this._current = -1;
    this._turned = [];
  };

  /**
   * Append field to wrapper.
   *
   * @param {jQuery} $container
   */
  C.prototype.attach = function ($container) {
    var self = this;
    
    this._$inner = $container.addClass('h5p-dialogcards').html('\
      <div class="h5p-title">' + this.params.title + '</div>\
      <div class="h5p-description">' + this.params.description + '</div>\
     ' + C.createCards(this.params.dialogs, this.params.answer) + '\
      <div class="h5p-inner">\
        <div class="h5p-button h5p-prev" role="button" tabindex="1">' + this.params.prev + '</div>\
        <div class="h5p-button h5p-next" role="button" tabindex="1">' + this.params.next + '</div>\
        <div class="h5p-progress"></div>\
      </div>');
    
    this._$progress = this._$inner.find('.h5p-progress');
    this._$current = this._$inner.find('.h5p-current');
    
    this._$inner.find('.h5p-turn').click(function () {
      self.turnCard($(this).parent().parent());
    });
    
    this._$prev = this._$inner.find('.h5p-prev').click(function () {
      self.prevCard();
    });
    
    this._$next = this._$inner.find('.h5p-next').click(function () {
      self.nextCard();
    });
    
    this.updateNavigation();
  };
  
  C.createCards = function (cards, turn) {
    var html = '';
    for (var i = 0; i < cards.length; i++) {
      html += '\
        <div class="h5p-cardwrap' + (i === 0 ? ' h5p-current' : '') + '">\
          <div class="h5p-cardholder">\
            <div class="h5p-card">' + cards[i].text + '</div>\
            <div class="h5p-button h5p-turn" role="button">' + turn + '</div>\
          </div>\
        </div>';
    }
    return html;
  };
  
  C.prototype.updateNavigation = function () {
    if (this._$current.next('.h5p-cardwrap').length) {
      this._$next.removeClass('h5p-disabled');
    }
    else {
      this._$next.addClass('h5p-disabled');
    }
    
    if (this._$current.prev('.h5p-cardwrap').length) {
      this._$prev.removeClass('h5p-disabled');
    }
    else {
      this._$prev.addClass('h5p-disabled');
    }
    
    this._$progress.text(this.params.progressText.replace('@card', this._$current.index() - 1).replace('@total', this.params.dialogs.length));
  };
  
  C.prototype.nextCard = function () {
    var $next = this._$current.next('.h5p-cardwrap');
    if ($next.length) {
      this._$current.removeClass('h5p-current').addClass('h5p-previous');
      this._$current = $next.addClass('h5p-current');
      this.updateNavigation();
    }
  };
  
  C.prototype.prevCard = function () {
    var $prev = this._$current.prev('.h5p-cardwrap');
    if ($prev.length) {
      this._$current.removeClass('h5p-current');
      this._$current = $prev.addClass('h5p-current').removeClass('h5p-previous');
      this.updateNavigation();
    }
  };
    
  C.prototype.turnCard = function ($card) {
    $card.find('.h5p-card').text(this.params.dialogs[$card.index() - 2].answer);
    $card.find('.h5p-card').addClass('h5p-collapse');
    setTimeout(function () {
        $card.find('.h5p-card').removeClass('h5p-collapse');
      }, 150);
    $card.find('.h5p-turn').addClass('h5p-disabled');
    if (!this._$current.next('.h5p-cardwrap').length) {
      $card.find('.h5p-cardholder').append('<div class="h5p-endcomment">' + this.params.endComment + '</div>');
    }
  };
  
  return C;
})(H5P.jQuery);

