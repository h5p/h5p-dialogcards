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

        /**
         * Convert text input to escaped HTML.
         *
         * @private
         * @param {string} input Text
         * @return {string} HTML compatible text
         */
        function toHtml(input) {
          return input
              .replace(/"/g, '&quot;')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
        };

        /**
         * Applies converter process to each property on the given target.
         *
         * @private
         * @param {array} properties
         * @param {function} converter
         * @return {function} Handler that converts the given object
         */
        function convert(properties, converter) {
          return function (target) {
            properties.forEach(function (property) {
              if (target[property]) {
                target[property] = converter(target[property]);
              }
            });
          };
        };

        if (parameters.dialogs) {
          parameters.dialogs.forEach(convert(['text', 'answer'], toHtml));
        }

        // The old default was to scale the text and not the card
        if (parameters.behaviour) {
          parameters.behaviour.scaleTextNotCard = true;
        }

        // Complete
        finished(null, parameters);
      }
    }
  };
})(H5P.jQuery);
