$(document).ready(function() {
    Base.doReady();
});

var Base = (function() {
    // Validator

    $.validator.addMethod("defaultInvalid", function(value, element) {
        var placeholder = $(element).attr('placeholder');
        return !(element.value == placeholder);
    });

    $.validator.addMethod("quiz", function(value, element) {
        return (value.toLowerCase() == 'xyz');
    });

    // Window events

    $(window).resize(function() {
        clearTimeout(this.id);
        this.id = setTimeout(Base.resizeElements, 250);
    });

    // Return

    return {
        bp: {
            lg: 1199,
            md: 999,
            sm: 767,
            xs: 599
        },
        windowWidth: 0,
        windowHeight: 0,
        galleryTotal: 0,

        calcPosition: function($image, captionHeight) {
            var size = {};
            var height = $image.attr('height');
            var width = $image.attr('width');
            var ratio = height / width;
            var vPadding = (parseInt($('#popupGalleryWrapper').css('padding-top')) * 2) + (parseInt($('#popupGallery').css('padding-top')) * 2);
            size.width = $('#popupImageWrapper').width();
            var desiredHeight = size.width * ratio;
            var maxHeight = Base.windowHeight - vPadding - captionHeight;
            size.height = Math.min(desiredHeight, maxHeight);
            if (size.height != desiredHeight) {
                size.width = maxHeight / ratio;
            }
            size.marginTop = (maxHeight - size.height) / 2;
            return size;
        },

        loadLightboxImage: function($image, captionHTML, newPopup) {
            var id = $image.data('id');
            var src = $image.data('full-image');
            if (newPopup) {
                $('#popupGalleryWrapper').fadeIn(600);
                $('#popupGalleryText').html(captionHTML);
                var captionHeight = $('#popupGalleryText').outerHeight();
                $('#popupGalleryText').hide();
                var size = Base.calcPosition($image, captionHeight);
                $('.galleryArrow').css('top', 10 + (size.height / 2));
                $('#popupGallery').css('margin-top', size.marginTop);
                $('#popupImage').css({
                    height: size.height,
                    width: size.width
                }).append('<img class="fullWidth">');
                $('#popupImage img').attr({
                    'src': src,
                    'alt': $image.attr('alt'),
                    'height': $image.attr('height'),
                    'width': $image.attr('width')
                }).data('id', id);
                $('#popupGalleryText').show();
                setTimeout(function() {
                    $('#popupGallery').addClass('animate');
                }, 1);
            }
            else {
                $('#popupGalleryText').slideUp(300);
                $('#popupImage img').fadeOut(300, function() {
                    $('#popupGalleryText').html(captionHTML).show();
                    var captionHeight = $('#popupGalleryText').outerHeight();
                    $('#popupGalleryText').hide();
                    var size = Base.calcPosition($image, captionHeight);
                    $('.galleryArrow').css('top', 10 + (size.height / 2));
                    $('#popupGallery').css('margin-top', size.marginTop);
                    $('#popupImage').css({
                        height: size.height,
                        width: size.width
                    });
                    $('#popupImage img').attr({
                        'src': src,
                        'alt': $image.attr('alt'),
                        'height': $image.attr('height'),
                        'width': $image.attr('width')
                    }).data('id', id);
                    $('#popupGalleryText').slideDown(600);
                    setTimeout(function() {
                        $('#popupImage img').fadeIn(600);
                    }, 600);
                });
            }
        },

        setupArrows: function(i) {
            var leftNext = i;
            var rightNext = i;
            if (i == 1) {
                leftNext = Base.galleryTotal;
                rightNext++;
            }
            else if (i == Base.galleryTotal) {
                leftNext = Base.galleryTotal - 1;
                rightNext = 1;
            }
            else {
                leftNext--;
                rightNext++;
            }
            $('#galleryPrev').data('id', leftNext);
            $('#galleryNext').data('id', rightNext);
        },

        resizeLightboxImage: function() {
            var $image = $('#popupImage img');
            var captionHeight = $('#popupGalleryText').outerHeight();
            var size = Base.calcPosition($image, captionHeight);
            $('.galleryArrow').css('top', 10 + (size.height / 2));
            $('#popupGallery').css('margin-top', size.marginTop);
            $('#popupImage').css({
                height: size.height,
                width: size.width
            });
        },

        resizeIframes: function() {
            $('.mediaWrapper iframe').each(function() {
                var height = $(this).attr('height');
                var width = $(this).attr('width');
                var ratio = height / width;
                $(this).css('max-width', width+'px');
                var displayWidth = $(this).width();
                $(this).height(displayWidth * ratio);
            });
        },

        centreImageInParent: function() {
            $('img.bgImage').each(function() {
                var parentWidth = $(this).parents('.bgCoverMeasure').outerWidth();
                var parentHeight = $(this).parents('.bgCoverMeasure').outerHeight();
                var parentRatio = parentWidth / parentHeight;
                var imageWidth = $(this).attr('width');
                var imageHeight = $(this).attr('height');
                var imageRatio = imageWidth / imageHeight;
                if (parentRatio < imageRatio) {
                    $(this).height(parentHeight).width(parentHeight * imageRatio);
                    var newWidth = parentHeight * imageRatio;
                    var leftIndent = (Math.floor(newWidth - parentWidth)) / 2;
                    $(this).css({ marginTop: 0, marginLeft: '-'+ leftIndent +'px' });
                }
                else {
                    $(this).height(parentWidth / imageRatio).width(parentWidth);
                    var newHeight = parentWidth / imageRatio;
                    var topIndent = (Math.floor(newHeight - parentHeight)) / 2;
                    $(this).css({ marginLeft: 0, marginTop: '-'+ topIndent +'px' });
                }
            });
        },

        loadMap: function() {
            var lat = $("#googleMap").data('lat');
            var lng = $("#googleMap").data('lng');

            var latLng = new google.maps.LatLng(lat, lng);
            
            var mapOptions = {
                zoom: 16,
                center: latLng,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                scrollwheel: false
            };

            if (Modernizr.touchevents) mapOptions.draggable = false;
            
            var map = new google.maps.Map($("#googleMap").get(0), mapOptions);
            
            var marker = new google.maps.Marker({
                map: map,
                position: latLng,
                icon: markerIcon
            });
        },

        resizeElements: function() {
            // Setup
            Base.windowWidth = $(window).width();
            Base.windowHeight = window.innerHeight ? window.innerHeight : $(window).height();
            if (Base.windowWidth > Base.bp.sm) {
                $('#navWrapper').show();
                $('#menuIcon').removeClass('active');
                $('#logo').removeClass('white');
            }
            else if (!$('#menuIcon').hasClass('active')) {
                $('#navWrapper').hide();
                $('#logo').removeClass('white');
            }
            // Lightbox gallery resize
            if ($('#popupImage:visible').length) Base.resizeLightboxImage();
            // Resize iframes
            Base.resizeIframes();
            // Centre images
            Base.centreImageInParent();
            // Map
            if ($('#googleMap').length) Base.loadMap();
        },

        doReady: function() {
            // Setup
            Base.resizeElements();
            if ($('#imageGallery').length) Base.galleryTotal = $('#imageGallery .galleryItem').length;

            // Vimeo player
            if ($('#homeVideo').length) {
                var $iframe = $('#homeVideo iframe');
                var player = new Vimeo.Player($iframe);
                player.setVolume(0);
                player.setLoop(true);
                player.play();
            }
            
            // Mobile menu open
            $('#menuIcon').on('vclick', function(e) {
                e.preventDefault();
                if ($(this).hasClass('active')) {
                    $('#navWrapper').fadeOut(600);
                    $(this).removeClass('active');
                    $('#logo').removeClass('white');
                }
                else {
                    $('#navWrapper').fadeIn(600);
                    $(this).addClass('active');
                    $('#logo').addClass('white');
                }
            });
            
            // Mobile menu close
            $('#menuClose').on('vclick', function(e) {
                e.preventDefault();
                $('#navWrapper').fadeOut(600);
                $('#menuIcon').removeClass('active');
                $('#logo').removeClass('white');
            });

            // Twitter carousel
            $('#twitterFeed').slick({
                infinite: false,
                speed: 300,
                slidesToShow: 5,
                swipeToSlide: true,
                prevArrow: '<span class="twitterArrow prev"></span>',
                nextArrow: '<span class="twitterArrow next"></span>',
                responsive: [
                    {
                        breakpoint: 1000,
                        settings: {
                            slidesToShow: 3
                        }
                    },
                    {
                        breakpoint: 600,
                        settings: {
                            slidesToShow: 2
                        }
                    },
                    {
                        breakpoint: 400,
                        settings: {
                            slidesToShow: 1
                        }
                    }
                ]
            });

            // Lightbox gallery open
            $('.galleryItem').on('vclick', function(e) {
                e.preventDefault();
                var $this = $(this);
                var id = $this.data('id');
                Base.setupArrows(id);
                var captionHTML = '<h4 class="smallTitle uppercase bold">'+ $this.data('title') +'</h4>';
                captionHTML += '<p class="bMar0">'+$this.data('caption')+'</p>';
                var $image = $this.children('img');
                Base.loadLightboxImage($image, captionHTML, true);
            });

            // Lightbox gallery nav
            $('.galleryArrow').on('vclick', function(e) {
                e.preventDefault();
                var id = $(this).data('id');
                Base.setupArrows(id);
                var $item = $('#imageGallery .galleryItem[data-id="'+id+'"]');
                var captionHTML = '<h4 class="smallTitle uppercase bold">'+ $item.data('title') +'</h4>';
                captionHTML += '<p class="bMar0">'+$item.data('caption')+'</p>';
                var $image = $item.children('img');
                Base.loadLightboxImage($image, captionHTML, false);
            });
            
            // Lightbox gallery swipe
            $('#popupImage').on('swiperight', function() {
                $('#galleryPrev').trigger('vclick');
            }).on('swipeleft', function() {
                $('#galleryNext').trigger('vclick');
            });

            // Lightbox gallery close
            $('#galleryClose').on('vclick', function(e) {
                e.preventDefault();
                $('#popupGalleryWrapper').fadeOut(600, function() {
                    $('#popupGallery').removeClass('animate');
                    $('#popupImage').empty();
                });
            });
            $(document).on('vclick', function(e) {
                if ($('#popupGalleryWrapper:visible').length && $(e.target).is('#popupGalleryWrapper')) {
                    $('#galleryClose').trigger('vclick');
                }
            });

            // Tweets
            $('.tweetWrapper').on('vclick', function(e) {
                if (!$(e.target).is('a')) {
                    e.preventDefault();
                    var id = $(this).data('id');
                    window.open('https://twitter.com/wishstudios/status/'+id);
                }
            });

            // Form submit
            $('a.submit').on('vclick', function(e) {
                e.preventDefault();
                $(this).parents('form').submit();
            });

            // Form placeholder fallback
            if (!Modernizr.input.placeholder) {
                $('input.placeholder, textarea.placeholder').each(function() {
                    var placeholder = $(this).attr('placeholder');
                    if ($(this).val() == '') $(this).val(placeholder);
                    $(this).focus(function() {
                        if ($(this).val() == placeholder) $(this).val('');
                    }).blur(function() {
                        if ($(this).val() == '') $(this).val(placeholder);
                    });
                });
            }
            
            // Enquiry form validate
            $('#enquiryForm').validate({
                highlight: function(element,errorClass) {
                    $(element).addClass('redBorder');
                },
                unhighlight: function(element,errorClass) {
                    $(element).removeClass('redBorder');
                },
                submitHandler: function(form) {
                    $(form).find('.submit').hide();
                    $(form).find('.sending').show();
                    $(form).ajaxSubmit({
                        resetForm: true,
                        success: function(data) {
                            $(form).find('.sending').fadeOut(300, function() {
                                $(form).find('.success').fadeIn(300);
                            });
                            setTimeout(function() {
                                $(form).find('.success').fadeOut(300, function() {
                                    $(form).find('.submit').fadeIn(300);
                                });
                            }, 5000);
                        },
                        error: function() {
                            $(form).find('.sending').fadeOut(300, function() {
                                $(form).find('.enquiryError').fadeIn(300);
                            });
                            setTimeout(function() {
                                $(form).find('.enquiryError').fadeOut(300, function() {
                                    $(form).find('.submit').fadeIn(300);
                                });
                            }, 5000);
                        }
                    });
                }
            });
        }
    }
}());