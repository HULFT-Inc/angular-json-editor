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
                    // // Fire the modified callback for immidiate return of form-dirty status
                    if (typeof scope.modified === 'function') {
                        return scope.modified({
                            $isFormDirty: isFormDirty,
                        });
                    }
                  });
                }

                function restart() {
                    var values = startVal;
                    if (scope.editor && scope.editor.destroy) {
                        values = scope.editor.getValue();
                        scope.editor.destroy();
                    }

                    scope.editor = new JSONEditor(element[0], {
                        startval: values,
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

                // update schema if promise
                scope.$watchCollection('schema', function (newVal) {
                    if (newVal instanceof $q) {
                        newVal.then(function (data) {
                            if (data.data) {
                                schema = data.data;
                            } else {
                                schema = data;
                            }
                            restart();
                        });
                    }
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
