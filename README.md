ScreenGallery
===========

A MooTools plugin that displays a fullscreen picture gallery with slideshow functionality.

SlideGallery does not include UI controls! It is intended to solely provide a framework for loading pictures, display them fullscreen and managing a slideshow. But it comes with a great API you can build on.

How to use
----------

    var container = $('gallery-container');

    var gallery = new ScreenGallery(container, {
        fadeOnReady         : false,
        readyFadeDuration:  : 500,
        minWidth            : 960,
        minHeight:          : null,
        verticalCenter      : false,
        horizontalCenter    : true,
        remainOffsetPercent : 6,
        endFxDuration       : 200,
        slideshowInterval   : 5000,
        basePath            : '/gallery/',
        performance         : 'optimize',
        performanceDelay    : 50
    });

Events
------

- ready
- picture-set-ready
- load-complete
- before-slide-load
- after-slide-load
- before-slide
- after-slide

ToDo
----

* Better documentation
* Make heavy use of CSS3 to optimize speed
* Add ability to load pictures on demand
* Try to use canvas for image scaling
* Enhance picture cache mechanisms
* Exclude picture change effect from core library
* Add more picture change effects