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
      
      10: function (parameters, finished, extras) {

        // Update image items
        if (parameters.dialogs) {
          parameters.dialogs.forEach(function (dialog) {
            if (!dialog.image) {
              return; // skip
            }

            // Create new image
            const newImage = {
              library: 'H5P.Image 1.1',
              // Avoid using H5P.createUUID since this is an upgrade script and H5P function may change
              subContentId: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (char) {
                const random = Math.random()*16|0, newChar = char === 'x' ? random : (random&0x3|0x8);
                return newChar.toString(16);
              }),
              params: {
                alt: dialog.imageAltText || '',
                contentName: 'Image',
                title: dialog.imageAltText || '',
                file: dialog.image
              },
              metadata: {}
            };

            // Move copyright data to metadata
            const copyright = dialog.image.copyright;
            if (copyright) {
              let years = [];
              if (copyright.year) {
                // Try to find start and end year
                years = copyright.year
                  .replace(' ', '')
                  .replace('--', '-') // Check for LaTeX notation
                  .split('-');
              }
              const yearFrom = (years.length > 0) ? new Date('00'.concat(years[0])).getFullYear() : undefined;
              const yearTo = (years.length > 0) ? new Date('00'.concat(years[1])).getFullYear() : undefined;

               // Build metadata object
              newImage.metadata = {
                title: copyright.title,
                authors: (copyright.author) ? [{name: copyright.author, role: ''}] : undefined,
                source: copyright.source,
                yearFrom: isNaN(yearFrom) ? undefined : yearFrom,
                yearTo: isNaN(yearTo) ? undefined : yearTo,
                license: copyright.license,
                licenseVersion: copyright.version
              };

              if (newImage.params.file) {
                delete newImage.params.file.copyright;
              }
            }

            dialog.media = newImage;

            delete dialog.image;
            delete dialog.imageAltText;      
    }
  };
})();
