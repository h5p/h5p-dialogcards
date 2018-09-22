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

      8: function (parameters, finished, extras) {
        // Update image items
        if (parameters.dialogs) {
          parameters.dialogs.forEach(function (dialog) {
            if (!dialog.image) {
              return; // skip
            }

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
              extras: {}
            };

            // Move copyright to metadata
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
              const yearFrom = (years.length > 0) ? new Date(years[0]).getFullYear() : undefined;
              const yearTo = (years.length > 0) ? new Date(years[1]).getFullYear() : undefined;

              // Build metadata object
              newImage.extras.metadata = {
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
          });
        }

        finished(null, parameters, extras);
      }
    }
  };
})();
