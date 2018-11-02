import Card from './h5p-dialogcards-card';

class CardPool {
  /**
   * @constructor
   *
   * TODO: Check what params are actually necessary
   *
   * @param {object} cards Card parameters.
   */
  constructor(params, contentId, callbacks) {
    this.params = params;
    this.contentId = contentId;
    this.callbacks = callbacks;
    this.cards = [];

    this.params.dialogs.forEach((dialog, index) => {
      dialog.id = index;
      this.cards.push(index);
    });

    return this;
  }

  /**
   * Retrieve a card.
   *
   * @param {number} id Id of card to retrieve.
   */
  getCard(id) {
    if (id < 0 || id > this.cards.length) {
      return;
    }

    // Replace id with card object if necessary.
    if (typeof this.cards[id] === 'number') {
      this.loadCard(id);
    }

    return this.cards[id];
  }

  /**
   * Get initial card ids.
   *
   * @return {object[]} Card ids.
   */
  getCardIds()  {
    return this.cards.map((card, index) => index);
  }

  /**
   * Load a card.
   *
   * @param {number} id Id of card to load.
   */
  loadCard(id) {
    if (id < 0 || id > this.cards.length) {
      return;
    }

    if (typeof this.cards[id] === 'number') {
      this.cards[id] = new Card(this.params.dialogs[id], this.params, id, this.contentId, this.callbacks);
    }
  }

}

export default CardPool;
