var H5PUpgrades = H5PUpgrades || {};

H5PUpgrades['H5P.Dialogcards'] = (function ($) {
  return {
    1: {
      /**
       * Asynchronous content upgrade hook.
       * Upgrades content parameters to support DQ 1.4.
       *
       * Converts text and answer into rich text.
       * Escapes 'dangerous' symbols.
       *
       * @param {Object} parameters
       * @param {function} finished
       */
      4: function (parameters, finished) {
        // The old default was to scale the text and not the card
        parameters.behaviour = {
          scaleTextNotCard: true
        };

        // Complete
        finished(null, parameters);
      },
      7: function (parameters, finished) {
        // Convert randomCards from boolean to string option
        if (parameters && parameters.behaviour && parameters.behaviour.randomCards !== undefined) {
          parameters.behaviour.randomCards = (parameters.behaviour.randomCards ? 'random' : 'normal');
        }

        // Complete
        finished(null, parameters);
      },
      8: function (parameters, finished, extras) {
        var extrasOut = extras || {};
        // Set new show title parameter
        if (parameters.title) {
          parameters.behaviour.showTitle = true;
        }
        // Copy html-free title to new metadata structure if present
        var title = parameters.title || ((extras && extras.metadata) ? extras.metadata.title : undefined);
        if (title) {
          title = title.replace(/<[^>]*>?/g, '');
        }
        extrasOut.metadata = {
          title: title
        };

        // Remove old parameter
        delete parameters.title;

        finished(null, parameters, extrasOut);
      }
    }
  };
})(H5P.jQuery);
