var H5PUpgrades = H5PUpgrades || {};

H5PUpgrades['H5P.Dialogcards'] = (function () {
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

      7: function (parameters, finished, extras) {
        var extrasOut = extras || {};
        // Copy html-free title to new metadata structure if present
        var title = parameters.title || ((extras && extras.metadata) ? extras.metadata.title : undefined);
        if (title) {
          title = title.replace(/<[^>]*>?/g, '');
        }
        extrasOut.metadata = {
          title: title
        };

        finished(null, parameters, extrasOut);
      },

      9: function (parameters, finished, extras) {
        if (parameters && parameters.dialogs && Array.isArray(parameters.dialogs)) {
          /*
           * Regardless of what alignment was set in the editor, the stylesheet
           * would always center the text. For not breaking the view of existing
           * content, set all text to be centered in params - can be changed by
           * user in the editor after upgrade.
           */
          parameters.dialogs.forEach(function (dialog) {
            // Update text on front
            if (typeof dialog.text === 'string') {
              if (dialog.text.substr(0, 2) !== '<p') {
                dialog.text = '<p style="text-align: center;">' + dialog.text + '</p>'; // was plain text
              }
              else {
                dialog.text = dialog.text.replace(/<p[^>]*>/g, '<p style="text-align: center;">');
              }
            }

            // Update text on back
            if (typeof dialog.answer === 'string') {
              if (dialog.answer.substr(0, 2) !== '<p') {
                dialog.answer = '<p style="text-align: center;">' + dialog.answer + '</p>'; // was plain text
              }
              else {
                dialog.answer = dialog.answer.replace(/<p[^>]*>/g, '<p style="text-align: center;">');
              }
            }
          });
        }

        finished(null, parameters, extras);
      },

      /**
       * Asynchronous content upgrade hook.
       * Upgrades content parameters to use new structure. Moves existing values
       * to separate property objects for front and back.
       *
       * @param {Object} parameters
       * @param {function} finished
       */
      10: function (parameters, finished, extras) {
        parameters.dialogs = parameters.dialogs || [];
        parameters.dialogs = parameters.dialogs.map(function (dialog) {
          const newDialog = {};

          // Get copies of objects
          const image = dialog.image ? JSON.parse(JSON.stringify(dialog.image)) : undefined;
          const audio = dialog.audio ? JSON.parse(JSON.stringify(dialog.audio)) : undefined;

          dialog.tips = dialog.tips || {};

          // Move parameters
          newDialog.front = {
            text: dialog.text,
            image: image,
            imageAltText: dialog.imageAltText,
            audio: audio,
            tip: dialog.tips.front
          };

          // Keep previous logic: back has same image as front and no audio
          newDialog.back = {
            text: dialog.answer,
            image: image,
            imageAltText: dialog.imageAltText,
            tip: dialog.tips.back
          };

          return newDialog;
        });

        finished(null, parameters, extras);
      }
    }
  };
})();
