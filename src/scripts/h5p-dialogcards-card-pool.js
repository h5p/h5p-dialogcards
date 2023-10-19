import Card from './h5p-dialogcards-card';

class CardPool {
  /**
   * @constructor
   *
   * @param {object} params Parameters from content type.
   * @param {number} contentId Id of content.
   * @param {object} callbacks Callbacks to main component.
   * @param {number} idCounter
   */
  constructor(params, contentId, callbacks, idCounter) {
    this.params = params;
    this.contentId = contentId;
    this.callbacks = callbacks;
    this.idCounter = idCounter;
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
   * Load a card if not loaded yet.
   *
   * @param {number} id Id of card to load.
   */
  loadCard(id) {
    if (id < 0 || id > this.cards.length) {
      return;
    }

    if (typeof this.cards[id] === 'number') {
      this.cards[id] = new Card(
        this.params.dialogs[id],
        this.params,
        id,
        this.contentId,
        this.callbacks,
        this.idCounter);
    }
  }

}

export default CardPool;
