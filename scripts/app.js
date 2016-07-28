/**
 *
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
APP.Main = (function() {

  var LAZY_LOAD_THRESHOLD = 300;
  var $ = document.querySelector.bind(document);

  var stories = null;
  var storyStart = 0;
  var count = 100;
  var main = $('main');
  var inDetails = false;
  var storyLoadCount = 0;
  var localeData = {
    data: {
      intl: {
        locales: 'en-US'
      }
    }
  };

  var tmplStory = $('#tmpl-story').textContent;
  var tmplStoryDetails = $('#tmpl-story-details').textContent;
  var tmplStoryDetailsComment = $('#tmpl-story-details-comment').textContent;

  if (typeof HandlebarsIntl !== 'undefined') {
    HandlebarsIntl.registerWith(Handlebars);
  } else {

    // Remove references to formatRelative, because Intl isn't supported.
    var intlRelative = /, {{ formatRelative time }}/;
    tmplStory = tmplStory.replace(intlRelative, '');
    tmplStoryDetails = tmplStoryDetails.replace(intlRelative, '');
    tmplStoryDetailsComment = tmplStoryDetailsComment.replace(intlRelative, '');
  }

  var storyTemplate =
      Handlebars.compile(tmplStory);
  var storyDetailsTemplate =
      Handlebars.compile(tmplStoryDetails);
  var storyDetailsCommentTemplate =
      Handlebars.compile(tmplStoryDetailsComment);

  /**
   * As every single story arrives in shove its
   * content in at that exact moment. Feels like something
   * that should really be handled more delicately, and
   * probably in a requestAnimationFrame callback.
   */
  function onStoryData (key, details) {

    // This seems odd. Surely we could just select the story
    // directly rather than looping through all of them.

    details.time *= 1000;
    var story = document.querySelector('#s-' + key);
    var html = storyTemplate(details);
    story.innerHTML = html;
    story.addEventListener('click', onStoryClick.bind(this, details));
    story.classList.add('clickable');

    // Tick down. When zero we can batch in the next load.
    storyLoadCount--;

    // Colorize on complete.
    if (storyLoadCount === 0)
      colorizeAndScaleStories();
  }

  function onStoryClick(details) {

    var storyDetails = $('#sd');

    var comment;
    var commentsElement;
    var storyHeader;
    var storyContent;
    var closeButton;

    var storyDetailsHtml = storyDetailsTemplate(details);
    var kids = details.kids;
    var commentHtml = storyDetailsCommentTemplate({
        by: '', text: 'Loading comment...'
    });

    if (details.url)
        details.urlobj = new URL(details.url);

    if (!storyDetails) {

        storyDetails = document.createElement('section');
        storyDetails.setAttribute('id', 'sd');
        storyDetails.classList.add('story-details');
        document.body.appendChild(storyDetails);
    }

    storyDetails.innerHTML = storyDetailsHtml;

    commentsElement = storyDetails.querySelector('.js-comments');
    storyHeader = storyDetails.querySelector('.js-header');
    storyContent = storyDetails.querySelector('.js-content');
    closeButton = storyDetails.querySelector('.js-close');

    closeButton.addEventListener('click', hideStory.bind(this));

    if (typeof kids === 'undefined')
        return;

    commentsElement.innerHTML = '';

    for (var k = 0; k < kids.length; k++) {

        comment = document.createElement('aside');
        comment.setAttribute('id', 'sdc-' + kids[k]);
        comment.classList.add('story-details__comment');
        comment.innerHTML = commentHtml;
        commentsElement.appendChild(comment);

        // Update the comment with the live data.
        APP.Data.getStoryComment(kids[k], function(commentDetails) {

            commentDetails.time *= 1000;

            var comment = commentsElement.querySelector(
                '#sdc-' + commentDetails.id);
            comment.innerHTML = storyDetailsCommentTemplate(
                commentDetails,
                localeData);
        });
    }
    showStory();
  }

  function showStory() {

    if (inDetails)
      return;

    var storyDetails = $('#sd');
    if (!storyDetails)
      return;

    storyDetails.classList.add('visible');
    inDetails = true;

  }

  function hideStory(id) {

    if (!inDetails)
      return;

    $('#sd').classList.remove('visible');
    inDetails = false;
  }

  /**
   * Does this really add anything? Can we do this kind
   * of work in a cheaper way?
   */
  function colorizeAndScaleStories() {
    // Select all stories
    var storyElements = document.querySelectorAll('.story');
    // Prepare array for stories we want to edit
    var onScreenStories = [];

    // Go through all stories and figure out if it is on the screen
    for (var s = 0; s < storyElements.length; s++) {
        var storyPosition = storyElements[s].getBoundingClientRect();
        // It IS on the screen if its storyPosition.top > 0
        if (storyPosition.top > 0) {
            // and if its storyPosition.top > mainOffsetHeight
            // then it is above the screen
            if (storyPosition.top > mainOffsetHeight) {
                // and if we found element that above the screen
                // all other stories also not visible
                // so we can break the loop
                break;
            }
            else {
                // if storyPosition.top > 0 && storyPosition.top > mainOffsetHeight
                // it is on the screen, so we can push it in on-screen-array
                // as object with info about its scale and opacity
                onScreenStories.push({
                    'story': storyElements[s],
                    'scale': Math.min(1, 1 - Math.pow(((storyPosition.top - 170) / mainOffsetHeight), 2)),
                    'opacity': Math.min(1, 1.2 - (1 * ((storyPosition.top - 170) / mainOffsetHeight)))
                });
            }
        }
    }

    // Apply style changes for selected on-screen-elements
    for (var s = 0; s < onScreenStories.length; s++) {
        onScreenStories[s].story.querySelector('.story__score').style.transform = 'scale(' + onScreenStories[s].scale + ', ' + onScreenStories[s].scale + ')';
        onScreenStories[s].story.style.opacity = onScreenStories[s].opacity;
    }
  }

  var header = $('header');
  var headerTitles = header.querySelector('.header__title-wrapper');
  var mainOffsetHeight = main.offsetHeight;
  main.addEventListener('scroll', function() {
    var mainScrollTop = main.scrollTop;
    var scrollTopCapped = Math.min(70, mainScrollTop);
    var scaleString = 'scale(' + (1 - (scrollTopCapped / 300)) + ')';

    header.style.height = (156 - scrollTopCapped) + 'px';
    headerTitles.style.webkitTransform = scaleString;
    headerTitles.style.transform = scaleString;

    colorizeAndScaleStories();

    // Add a shadow to the header.
    if (mainScrollTop > 70)
      document.body.classList.add('raised');
    else
      document.body.classList.remove('raised');

    // Check if we need to load the next batch of stories.
    var loadThreshold = (main.scrollHeight - mainOffsetHeight -
        LAZY_LOAD_THRESHOLD);
    if (mainScrollTop > loadThreshold)
      loadStoryBatch();
  });

  function loadStoryBatch() {

    if (storyLoadCount > 0)
      return;

    storyLoadCount = count;

    var end = storyStart + count;
    for (var i = storyStart; i < end; i++) {

      if (i >= stories.length)
        return;

      var key = String(stories[i]);
      var story = document.createElement('div');
      story.setAttribute('id', 's-' + key);
      story.classList.add('story');
      story.innerHTML = storyTemplate({
        title: '...',
        score: '-',
        by: '...',
        time: 0
      });
      main.appendChild(story);

      APP.Data.getStoryById(stories[i], onStoryData.bind(this, key));
    }

    storyStart += count;

  }

  // Bootstrap in the stories.
  APP.Data.getTopStories(function(data) {
    stories = data;
    loadStoryBatch();
    main.classList.remove('loading');
  });

})();
