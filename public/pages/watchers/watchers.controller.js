/* global angular */
import { isObject, find, keys, forEach } from 'lodash';
import moment from 'moment';
import $ from 'jquery';
import ace from 'ace';

import confirmMessageTemplate from '../../confirm_message/confirm_message.html';

// WATCHERS CONTROLLER
const WatchersController = function ($rootScope, $scope, $route, $interval,
  $timeout, timefilter, Private, createNotifier, $window, $http, $uibModal, $log, navMenu,
  globalNavState, $location, dataTransfer, Watcher, Script, Promise) {

  $scope.title = 'Sentinl: ';
  $scope.description = 'Kibi/Kibana Report App for Elasticsearch';

  const notify = createNotifier({
    location: 'Sentinl Watchers'
  });

  $scope.topNavMenu = navMenu.getTopNav('watchers');
  $scope.tabsMenu = navMenu.getTabs();
  navMenu.setKbnLogo(globalNavState.isOpen());
  $scope.$on('globalNavState:change', () => navMenu.setKbnLogo(globalNavState.isOpen()));

  timefilter.enabled = false;
  $scope.watchers = [];

  /**
  * Run watcher on demand.
  *
  * @param {string} id - watcher id
  */
  $scope.playWatcher = function (task) {
    Watcher.play(task._id)
      .then(function (data) {
        if (data.resp.message) {
          notify.warning(data.resp.message);
        } else {
          notify.info(`Executed watcher "${task._source.title}"`);
        }
      })
      .catch(function (error) {
        notify.error(error);
      });
  };

  /**
  * Opens watcher editor or wizard.
  *
  * @param {object} watcher - watcher object.
  * @param {string} type - editor, wizard.
  */
  $scope.editWatcher = function (watcher, type) {
    let path = `/${type}`;

    if (isObject(watcher)) {
      dataTransfer.setWatcher(watcher);
    } else {
      path += `/${watcher}`;
    }

    $location.path(path);
  };

  /**
  * Gets watcher object created by Kibana dashboard spy button.
  */
  const importWatcherFromLocalStorage = function () {
    /* New Entry from Saved Kibana Query */
    if ($window.localStorage.getItem('sentinl_saved_query')) {
      const spyPanelWatcher = angular.fromJson($window.localStorage.getItem('sentinl_saved_query'));
      $window.localStorage.removeItem('sentinl_saved_query');
      $scope.editWatcher(spyPanelWatcher, 'wizard');
    }
  };

  /**
  * Lists all existing watchers.
  */
  const listWatchers = function () {
    Watcher.list()
      .then((response) => {
        $scope.watchers = response;
        importWatcherFromLocalStorage();
      })
      .catch(notify.error)
      .finally(importWatcherFromLocalStorage);
  };

  listWatchers();

  // List the saved watcher.
  $scope.$on('editorCtrl-Watcher.save', () => {
    listWatchers();
  });


  /**
  * Deletes watcher.
  *
  * @param {string} id - watcher id.
  */
  $scope.deleteWatcher = function (id) {
    const index = $scope.watchers.findIndex((watcher) => watcher._id === id);

    const confirmModal = $uibModal.open({
      template: confirmMessageTemplate,
      controller: 'ConfirmMessageController',
      size: 'sm'
    });

    confirmModal.result.then(function (response) {
      if (response === 'yes') {
        Watcher.delete($scope.watchers[index]._id).then(function (id) {
          notify.info(`Deleted watcher "${$scope.watchers[index]._source.title}"`);
          $scope.watchers.splice(index, 1);
        }).catch(function (error) {
          if (Number.isInteger(index)) {
            $scope.watchers.splice(index, 1);
          } else {
            notify.error(error);
          }
        });
      }
    });
  };

  /**
  * Saves watcher.
  *
  * @param {integer} index - index number of watcher in $scope.watchers array.
  */
  const saveWatcher = function (index) {
    Watcher.save($scope.watchers[index])
      .then(function (id) {
        const status = $scope.watchers[index]._source.disable ? 'Disabled' : 'Enabled';
        const watcher = find($scope.watchers, (watcher) => watcher._id === id);
        notify.info(`${status} watcher "${watcher._source.title}"`);
      })
      .catch(notify.error);
  };

  /**
  * Enables or disables watcher.
  *
  * @param {string} id - watcher id.
  */
  $scope.toggleWatcher = function (id) {
    const index = $scope.watchers.findIndex((watcher) => watcher._id === id);
    $scope.watchers[index]._source.disable = !$scope.watchers[index]._source.disable;
    saveWatcher(index);
  };

  /**
  * Creates new watcher.
  *
  * @param {string} type - action type (email, report).
  */
  $scope.newWatcher = function (type) {
    Watcher.new(type)
      .then((watcher) => $scope.editWatcher(watcher, 'editor'))
      .catch(notify.error);
  };

  const templates = {
    input: {},
    condition: {},
    transform: {}
  };

  /**
  * Load templates for watcher fields.
  *
  * @param {array} templates - list of field names for templates
  */
  Promise.map(keys(templates), function (field) {
    return Script.list(field)
      .then(function (_templates_) {
        if (_templates_.length) {
          forEach(_templates_, function (template) {
            templates[field][template._id] = template;
          });
        }
        return null;
      });
  })
  .then(function () {
    dataTransfer.setTemplates(templates);
    return null;
  })
  .catch(notify.error);

  const currentTime = moment($route.current.locals.currentTime);
  $scope.currentTime = currentTime.format('HH:mm:ss');
  const utcTime = moment.utc($route.current.locals.currentTime);
  $scope.utcTime = utcTime.format('HH:mm:ss');
  const unsubscribe = $interval(function () {
    $scope.currentTime = currentTime.add(1, 'second').format('HH:mm:ss');
    $scope.utcTime = utcTime.add(1, 'second').format('HH:mm:ss');
  }, 1000);
  $scope.$watch('$destroy', unsubscribe);

};

WatchersController.$inject = ['$rootScope', '$scope', '$route', '$interval',
'$timeout', 'timefilter', 'Private', 'createNotifier', '$window', '$http', '$uibModal', '$log', 'navMenu',
'globalNavState', '$location', 'dataTransfer', 'Watcher', 'Script', 'Promise'];
export default WatchersController;
