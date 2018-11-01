import CardPool from './h5p-dialogcards-cardpool';
import CardPile from './h5p-dialogcards-cardpile';

class CardManager {
  /**
   * @constructor
   */
  constructor(params, contentId, callbacks) {
    this.cardPiles = [];
    this.selectionIds = [];

    this.currentId = 0;

    this.cardPool = new CardPool(params, contentId, callbacks);

    return this;
  }

  createSelection() {
    // Normal mode only right now
    this.selectionIds = this.cardPool.getCardIds();
    this.cardPiles.push(new CardPile(this.selectionIds));

    return this.selectionIds;
  }

  find(id) {
    let found = -1;
    this.cardPiles.forEach((cardPile, index) => {
      if (found !== -1) {
        return;
      }
      if (cardPile.contains(id))  {
        found = index;
      }
    });
  }

  hasNextCard() {
    return this.currentId < this.selectionIds.length - 1;
  }

  hasPreviousCard() {
    return this.currentId > 0;
  }

  getNextCard() {
    if (!this.hasNextCard()) {
      return;
    }
    this.currentId++;
    return this.cardPool.getCard(this.selectionIds[this.currentId]);
  }

  getPreviousCard() {
    if (!this.hasPreviousCard) {
      return;
    }
    this.currentId--;
    return this.cardPool.getCard(this.selectionIds[this.currentId]);
  }

  reset() {
    return;
  }

  getCard(id) {
    return this.cardPool.getCard(id);
  }
}

export default CardManager;
