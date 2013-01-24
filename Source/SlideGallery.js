/*
---

name: Slidegallery

description: Fullscreen gallery and slideshow library for MooTools

license: MIT-style

authors:
- fza

requires:
- [Core/Class, Core/Class.Extras, Core/Object, Core/Array, Element, Element/Style, Element/Event, Element/Dimensions, fza/CallStack]

provides: [SlideGallery]

...
*/

SlideGallery = new Class({
    Implements: [Options, Events, Stack],

    Binds: ['setPictures', 'slideTo', 'next', 'prev', 'startSlideshow', 'stopSlideshow', '_imageListener', '_slideCompleteListener', '_resizeListener'],

    options: {
        containerElementId: 'gallery',

        minWidth: 0,
        minHeight: 0,
        horizontalCenter: true,
        verticalCenter: true,

        fadeOnReady: true,
        protect: true,
        performance: 'optimize',
        performanceDelay: 50,

        basePath: '',

        endFxDuration: 250,
        readyFadeDuration: 500,
        slideshowInterval: 5000,

        remainOffsetPercent: 8
    },

    vars: {
        list: null,
        container: null,

        curIndex: -1,
        length: 0,

        loadCounter: 0,

        ready: false,
        sliderReady: false,

        activeSlide: null,
        foreignSlides: new Elements(),

        nextSlide: null,
        nextSlideMode: null,
        nextSlideNoFx: false,

        inSlide: false,
        inSlideshow: false
    },

    initialize: function(container, options) {
        var that = this.setOptions(options),
            vars = that.vars,
            opts = that.options,
            galleryContainer;

        vars.mSize = {
            x: Math.max(0, opts.minWidth),
            y: Math.max(0, opts.minHeight)
        };

        that.registerSyncMethods(['setPictures', 'slideTo', '_load', '_imageListener']);

        galleryContainer = vars.container = new Element('div', {
            id: opts.containerElementId,
            styles: {
                visibility: 'hidden'
            }
        }).inject($(container || document.body));
        vars.list = new Element('ul').inject(galleryContainer);

        ['resize', 'orientationchange'].each(function(evt) {
            window.addListener(evt, this._resizeListener.pass([]));
        }, that);
    },

    setPictures: function(srcs) {
        var that = this,
            vars = that.vars,
            loadFirstSlide, num = 0,
            reorderSlides = {},
            checkSrc = (function(slide) {
                var slideImgSrc = slide.retrieve('img-src');

                return srcs.some(function(src) {
                    // Do not destroy this slide if it contains an image that is also included in the new picture set.
                    if (src == slideImgSrc) {
                        reorderSlides[src] = slide;
                        return true;
                    }
                });
            }).bind(that);

        srcs = Array.from(srcs);

        if (!srcs.length) return that;

        // All following invocations on this gallery must be made using the new picture set!
        that.stopSlideshow();
        that.clearStack();

        vars.sliderReady = false;

        vars.list.getChildren('li').each(function(slide) {
            // Do not destroy this slide if it contains an image that is also included in the new picture set.
            if (checkSrc(slide)) return;

            // Otherwise destroy the slide if it's not active (visible)
            else if (!slide.hasClass('slide-active')) slide.destroy();

            // Mark the active (visible) slide to be destroyed after the launch of the new picture set
            else vars.foreignSlides.push(slide.addClass('slide-foreign').removeClass('slide-' + slide.retrieve('slide-num')));
        });

        srcs.each(function(src) {
            var exists = !! reorderSlides[src],
                slide = exists ? reorderSlides[src].removeClass('slide-' + reorderSlides[src].retrieve('slide-num')) : new Element('li', {
                    'class': 'slide-pending',
                    styles: {
                        visibility: 'hidden'
                    }
                }).store('img-src', src);

            slide.inject(vars.list).addClass('slide-' + num).store('slide-num', num++);

            if (vars.activeSlide == slide && num == 1) vars.omitNextNext = true;

            // Set the first slide to load
            if (!exists && !loadFirstSlide) loadFirstSlide = slide;
        });

        vars.curIndex = -1;
        vars.length = srcs.length;

        if (loadFirstSlide) that._load(loadFirstSlide, true);
        else that._launch();

        return that;
    },

    slideTo: function(num, direction, noFx) {
        var that = this,
            vars = that.vars,
            slide;

        if (!vars.sliderReady || num < 0 || num >= vars.length) return false;

        slide = vars.list.getChildren('li.slide-' + num)[0];

        if (direction == 'next' && vars.omitNextNext) {
            vars.omitNextNext = false;
            vars.curIndex = slide.retrieve('slide-num');
            return that;
        }

        vars.nextSlide = slide;
        vars.nextSlideMode = (direction && ['next', 'prev'].contains(direction)) ? direction : 'next';
        vars.nextSlideNoFx = !! noFx;

        if (slide.hasClass('slide-pending')) that._load(slide, true);
        else if (!slide.hasClass('slide-loading')) that._slide(slide);

        return that;
    },

    next: function(noFx, slideshowTrigger) {
        var that = this,
            vars = that.vars;

        if (!vars.sliderReady) return this;

        if (vars.inSlideshow && !slideshowTrigger) that.stopSlideshow();

        return that.slideTo((vars.curIndex == vars.length - 1 || vars.curIndex == -1) ? 0 : vars.curIndex + 1, 'next', noFx);
    },

    prev: function(noFx) {
        var that = this,
            vars = that.vars;

        if (!vars.sliderReady) return this;

        that.stopSlideshow();

        return that.slideTo((vars.curIndex == 0 || vars.curIndex == -1) ? vars.length - 1 : vars.curIndex - 1, 'prev', noFx);
    },

    startSlideshow: function() {
        var that = this,
            vars = that.vars;

        if (!vars.inSlideshow) {
            vars.slideshowTimer = that.next.periodical(that.options.slideshowInterval, that, [false, true]);
            vars.inSlideshow = true;
        }
        return that;
    },

    stopSlideshow: function() {
        var that = this,
            vars = that.vars;

        clearInterval(vars.slideshowTimer);
        vars.inSlideshow = false;

        return that;
    },


    /** Private methods **/

    _launch: function(slide) {
        var that = this,
            vars = that.vars,
            opts = that.options;

        if (vars.ready && vars.sliderReady) return;

        if (!vars.ready) {
            vars.ready = true;
            vars.activeSlide = slide.addClass('slide-active').setStyle('visibility', 'visible');
            that._resizeListener();
            vars.curIndex = 0;
            that.fireEvent('ready');

            if (opts.fadeOnReady && opts.readyFadeDuration > 0)(new Fx.Tween(vars.container, {
                fps: 'animationFrame',
                duration: opts.readyFadeDuration
            })).start('opacity', 0, 1);
            else vars.container.setStyle('visibility', 'visible');
        }

        vars.sliderReady = true;
        that.fireEvent('picture-set-ready');
    },

    _load: function(slide, immediate) {
        var that = this,
            vars = that.vars,
            img, alreadyLoading = false;

        if (!immediate && vars.loadCounter) return;

        if (slide.hasClass('slide-loading')) alreadyLoading = true;
        else slide.removeClass('slide-pending').addClass('slide-loading');

        if (immediate && !slide.retrieve('announced')) that._announce(slide);

        if (!alreadyLoading) {
            vars.loadCounter++;
            img = new Element('img').inject(slide);
            img.onload = that._imageListener.pass(['load', slide]);
            img.onabort = that._imageListener.pass(['abort', slide]);
            img.onerror = that._imageListener.pass(['error', slide]);
            img.set('src', that.options.basePath + slide.retrieve('img-src'));
        }
    },

    _imageListener: function(evt, slide) {
        var that = this,
            vars = that.vars,
            isNext, isAnnounced, slideNum, num = 0,
            nextSlide, img;

        if (!slide || !slide.getParent()) return;

        switch (evt) {
        case 'abort':
        case 'error':
            isNext = vars.nextSlide == slide, isAnnounced = slide.retrieve('announced'), slideNum = slide.retrieve('slide-num');
            slide.destroy();

            vars.list.getElements('li').each(function(slide) {
                if (slide.hasClass('slide-foreign')) return;
                slide.removeClass('slide-' + slide.retrieve('slide-num')).addClass('slide-' + num).store('slide-num', num++);
            });

            vars.length--;

            if (isNext) {
                if (vars.nextSlideMode == 'next') nextSlide = vars.list.getElement('li.slide-' + (slideNum >= (vars.length - 1) ? '0' : vars.activeSlide.retrieve('slide-num') + 1));
                else nextSlide = vars.list.getElement('li.slide-' + (slideNum <= 0 ? vars.length - 1 : vars.activeSlide.retrieve('slide-num') - 1));

                if (nextSlide == vars.activeSlide) nextSlide = null;
                else if (isAnnounced) that._announce(nextSlide);

                vars.nextSlide = nextSlide;
            }

            if (vars.curIndex != -1 && vars.curIndex > slideNum) vars.curIndex--;

            break;

        case 'load':
            img = slide.getFirst('img');
            if (that.options.protect) img.enableProtection();
            slide.removeClass('slide-loading');

            if (!vars.ready && slide.retrieve('slide-num') == 0) that._launch(slide);
            else if (vars.ready && !vars.sliderReady) that._launch();
            else if (vars.ready && vars.sliderReady && vars.nextSlide == slide) that._slide(slide, true);
        }

        vars.loadCounter--;
        if (!vars.loadCounter) {
            slide = vars.list.getElement('li.slide-pending');
            if (slide) that._load(slide);
            else that.fireEvent('load-complete');
        }
    },

    _performance: function(speed) {
        var that = this,
            vars = that.vars,
            opts = that.options;

        if (opts.performance != 'optimize') return;
        clearTimeout(vars.performanceTimer);

        if (speed) that._setPerformance(true);
        else vars.performanceTimer = that._setPerformance.delay(opts.performanceDelay, that, false);
    },

    _setPerformance: function(speed) {
        this.vars.list[(speed ? 'add' : 'remove') + 'Class']('speed');
    },

    _announce: function(slide) {
        if (!slide.retrieve('announced')) this.fireEvent('before-slide-load', [slide, slide.store('announced', true).retrieve('slide-num')]);
    },

    _slide: function(newSlide, afterLoad) {
        var that = this,
            vars = that.vars,
            opts = that.options,
            prevSlide, currentSlide, remainOffsetPixels, startX, noFx;

        if (!newSlide || !vars.nextSlide || !newSlide.getParent() || !vars.nextSlide.getParent() || vars.nextSlide != newSlide || vars.activeSlide == newSlide || newSlide.hasClass('slide-pending') || !that.checkStack(arguments)) return;

        prevSlide = vars.list.getChildren('li.slide-prev')[0], currentSlide = vars.list.getChildren('li.slide-active')[0], remainOffsetPixels = vars.container.getSize().x * (opts.remainOffsetPercent / 100), startX = vars.nextSlideMode == 'prev' ? -remainOffsetPixels : remainOffsetPixels, noFx = vars.nextSlideNoFx;

        vars.nextSlide = vars.nextSlideMode = vars.nextSlideNoFx = null;
        vars.activeSlide = newSlide;
        vars.curIndex = newSlide.retrieve('slide-num');
        vars.inSlide = true;

        if (afterLoad && newSlide.retrieve('announced')) that.fireEvent('after-slide-load', [newSlide, vars.curIndex]);

        prevSlide && prevSlide.removeClass('slide-prev');
        currentSlide.removeClass('slide-active').addClass('slide-prev');
        newSlide.setStyles({
            left: startX,
            visibility: 'hidden'
        }).addClass('slide-active');

        that._performance(true);
        that._resizeListener(newSlide.getFirst('img'), true);
        that.fireEvent('before-slide', [newSlide, vars.curIndex, vars.length]);

        if (noFx) {
            newSlide.setStyles({
                visibility: 'visible',
                left: 0
            });
            that._slideCompleteListener();
        } else {
            var fx = newSlide.retrieve('fx');
            if (!fx) {
                fx = new Fx.Tween(newSlide, {
                    fps: 'animationFrame',
                    duration: opts.endFxDuration,
                    transition: Fx.Transitions.Quart.easeOut
                }).addEvent('complete', that._slideCompleteListener);

                newSlide.store('fx', fx);
            }

            fx.set('visibility', 'visible').start('left', startX, 0);
        }
    },

    _slideCompleteListener: function(noReset) {
        var that = this,
            vars = that.vars;

        vars.list.getElement('.slide-prev').setStyle('visibility', 'hidden');

        that._performance();
        vars.inSlide = false;
        vars.foreignSlides.destroy().empty();

        that.fireEvent('after-slide', [vars.activeSlide, vars.curIndex, vars.length]);

        // Release lock set in _slide()
        that.callStack();
    },

    _resizeListener: (function() {
        var img, iSize, iRatio, cSize, mSize, imgX, imgY, resizeX = function(checkMin) {
                if (checkMin) {
                    var checkY = mSize.x * iRatio;
                    if (cSize.y <= checkY) setSize(mSize.x, checkY);
                    else resizeY();
                } else setSize(cSize.x, cSize.x * iRatio);
            },
            resizeY = function(checkMin) {
                if (checkMin) {
                    var checkX = mSize.y / iRatio;
                    if (cSize.x <= checkX) setSize(checkX, mSize.y);
                    else resizeX();
                } else setSize(cSize.y / iRatio, cSize.y);
            },
            setSize = function(x, y) {
                imgX = x;
                imgY = y;
                img.setStyles({
                    'width': x,
                    'height': y
                });
            };

        return function(element, noPerformance) {
            var that = this,
                vars = that.vars,
                opts = that.options;

            if (!noPerformance) that._performance(true);

            cSize = vars.container.getSize();
            if (!mSize) mSize = vars.mSize;

            (element ? [element] : vars.list.getElements('li.slide-active img' + (vars.inSlide ? ', li.slide-prev img' : ''))).each(function(element) {
                img = element;
                iSize = img.retrieve('orig-size') || (function() {
                    var obj = {
                        x: img.width,
                        y: img.height
                    };
                    img.store('orig-size', obj);
                    return obj;
                })();
                iRatio = img.retrieve('ratio') || (function() {
                    var r = iSize.y / iSize.x;
                    img.store('ratio', r);
                    return r;
                })();

                if (mSize.x > cSize.x) resizeX(true);
                else if (mSize.y > cSize.y) resizeY(true);
                else if ((cSize.y / cSize.x) > iRatio) resizeY();
                else resizeX();

                opts.horizontalCenter && img.setStyle('left', (cSize.x - imgX) / 2);
                opts.verticalCenter && img.setStyle('top', (cSize.y - imgY) / 2)
            }, that);

            if (!noPerformance) that._performance();
        };
    })()
});