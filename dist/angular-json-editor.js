(function (window, angular) {
'use strict';
// Source: src/angular-json-editor.js


angular.module('angular-json-editor', []).provider('JSONEditor', function () {
    var configuration = {
        defaults: {
            options: {
                iconlib: 'bootstrap3',
                theme: 'bootstrap3'
            }
        }
    };

    this.configure = function (options) {
        extendDeep(configuration, options);
    };

    this.$get = ['$window', function ($window) {
        // configure JSONEditor using provider's configuration
        var JSONEditor = $window.JSONEditor;
        extendDeep(JSONEditor, configuration);
        return $window.JSONEditor;
    }];

    // Helper method for merging configuration objects
    function extendDeep(dst) {
        angular.forEach(arguments, function (obj) {
            if (obj !== dst) {
                angular.forEach(obj, function (value, key) {
                    if (dst[key] && dst[key].constructor && dst[key].constructor === Object) {
                        extendDeep(dst[key], value);
                    } else {
                        dst[key] = value;
                    }
                });
            }
        });
        return dst;
    }

}).directive('jsonEditor', ['$q', 'JSONEditor', function ($q, JSONEditor) {

    return {
        restrict: 'E',
        transclude: true,
        scope: {
            schema: '=',
            startval: '=',
            buttonsController: '@',
            onChange: '&',
            modified: '&'
        },
        controller: ['$scope', '$attrs', '$controller', function ($scope, $attrs, $controller) {
            var controller, controllerScope, controllerName = $attrs.buttonsController;
            if (!(angular.isString(controllerName) && controllerName !== '')) {
                return;
            }

            controllerScope = {
                $scope: $scope
            };

            try {
                controller = $controller(controllerName, controllerScope);
            } catch (e) {
                // Any exceptions thrown will probably be because the controller specified does not exist
                throw new Error('angular-json-editor: buttons-controller attribute must be a valid controller.');
            }
        }],
        link: function (scope, element, attrs, controller, transclude) {
            var startValPromise = $q.when(scope.startval),
                schemaPromise = $q.when(scope.schema),
                isFormDirty = false,
                isFormValid = true;

            scope.isValid = false;

            if (!angular.isString(attrs.schema)) {
                throw new Error('angular-json-editor: schema attribute has to be defined.');
            }
            // Wait for the start value and schema to resolve before building the editor.
            $q.all([schemaPromise, startValPromise]).then(function (result) {

                // Support $http promise response with the 'data' property.
                var schema = result[0].data || result[0],
                    startVal = result[1].data || result[1];
                if (schema === null) {
                    throw new Error('angular-json-editor: could not resolve schema data.');
                }

                function checkFormDirtyStatus() {
                  $($(element[0]).find(':input')).on('change input', function () {
                    isFormDirty = true;
                    // Fire the modified callback for immidiate return of form-dirty status
                    if (typeof scope.modified === 'function') {
                        return scope.modified({
                            $isFormDirty: isFormDirty,
                        });
                    }
                  });
                }

                function removeFields (key) {
                    delete schema.properties[key];
                    delete startVal[key];
                    _.remove(schema.required, function(element) {
                      return element === key;
                    });
                }

                function changeDateFormat(inputDate) {
                  return moment(inputDate, ['MM-DD-YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY']).format('YYYY-MM-DD');
                }

                function removeFieldsToHide () {
                angular.forEach(schema.properties, function(value, key) {
                    startVal[key] = (value.format === 'date') ? changeDateFormat(startVal[key]) : startVal[key];
                    if (value.type === 'string') {
                        if (value.hideField) {
                            removeFields(key);
                        }
                    } else if (value.type === 'array') {
                        var checkAllItemsHidden = [];
                        if (value.hideField) {
                            removeFields(key);
                        } else {
                            angular.forEach(value.items.properties, function (key1, val1) {
                                checkAllItemsHidden.push(key1.hideField);
                                if (key1.hideField) {
                                    delete schema.properties[key].items.properties[val1];
                                    if(startVal[key]){
                                        for (var i = 0; i < startVal[key].length; i++) {
                                            delete startVal[key][i][val1];
                                        }
                                    }
                                    _.remove(value.items.required, function(element) {
                                    return element === val1;
                                    });
                                }
                                if (key1.format === 'date') {
                                  if(startVal[key]){
                                    for (var i = 0; i < startVal[key].length; i++) {
                                      startVal[key][i][val1] = changeDateFormat(startVal[key][i][val1]);
                                     }
                                  }
                                };
                            });
                            var allHidden = !!checkAllItemsHidden.reduce(function(a, b){ return (a === b) ? a : NaN; }, 0);
                            if(allHidden){
                             removeFields(key);
                            }
                        }
                    } else if (value.type === 'object') {
                      if (value.hideField) {
                        removeFields(key);
                      } else {
                        angular.forEach(value.properties, function (objectKey, ObjectVal) {
                          if (objectKey.hideField) {
                            delete schema.properties[key].properties[ObjectVal];
                            _.remove(value.required, function(element) {
                              return element === ObjectVal;
                            });
                            if (startVal[key]) {
                              delete startVal[key][ObjectVal];
                            }
                          }
                          if (!objectKey.hideField && objectKey.format === 'date' && startVal[key]) {
                            startVal[key][ObjectVal] = changeDateFormat(startVal[key][ObjectVal]);
                          }
                        });
                      }
                    }
                });
                return schema;
                }
                function restart() {
                    if (scope.editor && scope.editor.destroy) {
                        scope.editor.destroy();
                    }
                    schema = removeFieldsToHide(schema);
                    scope.editor = new JSONEditor(element[0], {
                        startval: startVal,
                        schema: schema
                    }, true);

                    scope.editor.on('ready', editorReady);
                    scope.editor.on('change', editorChange);
                    element.append(buttons);
                }

                function editorReady() {
                    scope.isValid = (scope.editor.validate().length === 0);
                }

                function editorChange() {
                    checkFormDirtyStatus();
                    if (scope.editor.validation_results.length > 0) {
                      isFormValid = false;
                    } else {
                      isFormValid = true;
                    }
                    // Fire the onChange callback
                    if (typeof scope.onChange === 'function') {
                        scope.onChange({
                            $editorValue: scope.editor.getValue(),
                            $isFormDirty: isFormDirty,
                            $isFormValid: isFormValid
                        });
                    }
                    // reset isValid property onChange
                    scope.$apply(function () {
                        scope.isValid = (scope.editor.validate().length === 0);
                    });
                }

                restart();

                scope.$watchGroup(['schema', 'startval'], function (newVal, oldVal) {
                  if (newVal[0]) {
                    schema = newVal[0];
                    if (scope.editor) {
                      startVal = scope.editor.getValue();
                    }
                  }
                  if (newVal[1]) {
                    startVal = newVal[1];
                  }
                  restart();
                });

                // resetting the data
                scope.$on('eventReset', function(event, data) {
                    scope.editor.setValue(data);
                });


                // Transclude the buttons at the bottom.
                var buttons = transclude(scope, function (clone) {
                    return clone;
                });

                transclude(scope, function (buttons) {
                    element.append(buttons);
                });


            });
        }
    };
}]);

})(window, angular);
