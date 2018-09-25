(function(factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['jquery'], function($){
            return factory(window, document, $);
        });
    } else if (typeof exports !== 'undefined') {
        module.exports = factory(window, document, require('jquery'));
    } else {
        return factory(window, document, jQuery);
    }
})(function(window, document, $){
    'use strict';

    // http://stackoverflow.com/questions/17242144/javascript-convert-hsb-hsv-color-to-rgb-accurately
    var HSVtoRGB = function( h, s, v )
    {
        var r, g, b, i, f, p, q, t;
        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6)
        {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        var hr = Math.floor(r * 255).toString(16);
        var hg = Math.floor(g * 255).toString(16);
        var hb = Math.floor(b * 255).toString(16);
        return '#' + (hr.length < 2 ? '0' : '') + hr +
                     (hg.length < 2 ? '0' : '') + hg +
                     (hb.length < 2 ? '0' : '') + hb;
    };

    // Encode htmlentities() - http://stackoverflow.com/questions/5499078/fastest-method-to-escape-html-tags-as-html-entities
    var html_encode = function( string )
    {
        return string.replace(/[&<>"]/g, function(tag)
        {
            var charsToReplace = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;'
            };
            return charsToReplace[tag] || tag;
        });
    };

    // Create the Editor
    var create_editor = function( $textarea, classes, placeholder, toolbar_position, toolbar_buttons, toolbar_submit, label_selectImage,
                                  placeholder_url, placeholder_embed, max_imagesize, filter_imageType, on_imageupload, force_imageupload, video_from_url,
                                  on_keydown, on_keypress, on_keyup, on_autocomplete )
    {
        // Content: Insert link
        var wysiwygeditor_insertLink = function( wysiwygeditor, url )
        {
            if( ! url )
                ;
            else if( wysiwygeditor.getSelectedHTML() )
                wysiwygeditor.insertLink( url );
            else
                wysiwygeditor.insertHTML( '<a href="' + html_encode(url) + '">' + html_encode(url) + '</a>' );
            wysiwygeditor.closePopup().collapseSelection();
        };
        var content_insertlink = function(wysiwygeditor, $modify_link)
        {
            var $inputurl = $('<input type="text" value="">').val( $modify_link ? $modify_link.attr('href') : '' )  // prop('href') does not reflect real value
                                .addClass('wysiwyg-input')
                                .keypress(function(event){
                                    if( event.which != 10 && event.which != 13 )
                                        return ;
                                    if( $modify_link )
                                    {
                                        $modify_link.prop( 'href', $inputurl.val() );
                                        wysiwygeditor.closePopup().collapseSelection();
                                    }
                                    else
                                        wysiwygeditor_insertLink( wysiwygeditor,$inputurl.val() );
                                });
            if( placeholder_url )
                $inputurl.prop( 'placeholder', placeholder_url );
            var $okaybutton = $();
            if( toolbar_submit )
                $okaybutton = toolbar_button(toolbar_submit).click(function(event){
                                    if( $modify_link )
                                    {
                                        $modify_link.prop( 'href', $inputurl.val() );
                                        wysiwygeditor.closePopup().collapseSelection();
                                    }
                                    else
                                        wysiwygeditor_insertLink( wysiwygeditor, $inputurl.val() );
                                    event.stopPropagation();
                                    event.preventDefault();
                                    return false;
                                });
            var $content = $('<div/>').addClass('wysiwyg-toolbar-form')
                                      .prop('unselectable','on');
            $content.append($inputurl).append($okaybutton);
            return $content;
        };

        // Content: Insert image
        var content_insertimage = function(wysiwygeditor)
        {
            // Add image to editor
            var insert_image_wysiwyg = function( url, filename )
            {
                var html = '<img id="wysiwyg-insert-image" src="" alt=""' + (filename ? ' title="'+html_encode(filename)+'"' : '') + '>';
                wysiwygeditor.insertHTML( html ).closePopup().collapseSelection();
                var $image = $('#wysiwyg-insert-image').removeAttr('id');
                if( max_imagesize )
                {
                    $image.css({maxWidth: max_imagesize[0]+'px',
                                maxHeight: max_imagesize[1]+'px'})
                          .load( function() {
                                $image.css({maxWidth: '',
                                            maxHeight: ''});
                                // Resize $image to fit "clip-image"
                                var image_width = $image.width(),
                                    image_height = $image.height();
                                if( image_width > max_imagesize[0] || image_height > max_imagesize[1] )
                                {
                                    if( (image_width/image_height) > (max_imagesize[0]/max_imagesize[1]) )
                                    {
                                        image_height = parseInt(image_height / image_width * max_imagesize[0]);
                                        image_width = max_imagesize[0];
                                    }
                                    else
                                    {
                                        image_width = parseInt(image_width / image_height * max_imagesize[1]);
                                        image_height = max_imagesize[1];
                                    }
                                    $image.prop('width',image_width)
                                          .prop('height',image_height);
                                }
                            });
                }
                $image.prop('src', url);
            };
            // Create popup
            var $content = $('<div/>').addClass('wysiwyg-toolbar-form')
                                      .prop('unselectable','on');
            // Add image via 'Browse...'
            var $fileuploader = null,
                $fileuploader_input = $('<input type="file">')
                                        .css({position: 'absolute',
                                              left: 0,
                                              top: 0,
                                              width: '100%',
                                              height: '100%',
                                              opacity: 0,
                                              cursor: 'pointer'});
            if( ! force_imageupload && window.File && window.FileReader && window.FileList )
            {
                // File-API
                var loadImageFromFile = function( file )
                {
                    // Only process image files
                    if( typeof(filter_imageType) === 'function' && ! filter_imageType(file) )
                        return;
                    else if( ! file.type.match(filter_imageType) )
                        return;
                    var reader = new FileReader();
                    reader.onload = function(event) {
                        var dataurl = event.target.result;
                        insert_image_wysiwyg( dataurl, file.name );
                    };
                    // Read in the image file as a data URL
                    reader.readAsDataURL( file );
                };
                $fileuploader = $fileuploader_input
                                    .prop('draggable','true')
                                    .change(function(event){
                                        var files = event.target.files; // FileList object
                                        for(var i=0; i < files.length; ++i)
                                            loadImageFromFile( files[i] );
                                    })
                                    .on('dragover',function(event){
                                        event.originalEvent.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
                                        event.stopPropagation();
                                        event.preventDefault();
                                        return false;
                                    })
                                    .on('drop', function(event){
                                        var files = event.originalEvent.dataTransfer.files; // FileList object.
                                        for(var i=0; i < files.length; ++i)
                                            loadImageFromFile( files[i] );
                                        event.stopPropagation();
                                        event.preventDefault();
                                        return false;
                                    });
            }
            else if( on_imageupload )
            {
                // Upload image to a server
                var $input = $fileuploader_input
                                    .change(function(event){
                                        on_imageupload.call( this, insert_image_wysiwyg );
                                    });
                $fileuploader = $('<form/>').append($input);
            }
            if( $fileuploader )
                $('<div/>').addClass( 'wysiwyg-browse' )
                           .html( label_selectImage )
                           .append( $fileuploader )
                           .appendTo( $content );
            // Add image via 'URL'
            var $inputurl = $('<input type="text" value="">').addClass('wysiwyg-input')
                                .keypress(function(event){
                                    if( event.which == 10 || event.which == 13 )
                                        insert_image_wysiwyg( $inputurl.val() );
                                });
            if( placeholder_url )
                $inputurl.prop( 'placeholder', placeholder_url );
            var $okaybutton = $();
            if( toolbar_submit )
                $okaybutton = toolbar_button(toolbar_submit).click(function(event){
                                    insert_image_wysiwyg( $inputurl.val() );
                                    event.stopPropagation();
                                    event.preventDefault();
                                    return false;
                                });
            $content.append( $('<div/>').append($inputurl).append($okaybutton) );
            return $content;
        };

        // Content: Insert video
        var content_insertvideo = function(wysiwygeditor)
        {
            // Add video to editor
            var insert_video_wysiwyg = function( url, html )
            {
                url = $.trim(url||'');
                html = $.trim(html||'');
                var website_url = false;
                if( url.length && ! html.length )
                    website_url = url;
                else if( html.indexOf('<') == -1 && html.indexOf('>') == -1 &&
                         html.match(/^(?:https?:\/)?\/?(?:[^:\/\s]+)(?:(?:\/\w+)*\/)(?:[\w\-\.]+[^#?\s]+)(?:.*)?(?:#[\w\-]+)?$/) )
                    website_url = html;
                if( website_url && video_from_url )
                    html = video_from_url( website_url ) || '';
                if( ! html.length && website_url )
                    html = '<video src="' + html_encode(website_url) + '">';
                wysiwygeditor.insertHTML( html ).closePopup().collapseSelection();
            };
            // Create popup
            var $content = $('<div/>').addClass('wysiwyg-toolbar-form')
                                      .prop('unselectable','on');
            // Add video via '<embed/>'
            var $textareaembed = $('<textarea>').addClass('wysiwyg-input wysiwyg-inputtextarea');
            if( placeholder_embed )
                $textareaembed.prop( 'placeholder', placeholder_embed );
            $('<div/>').addClass( 'wysiwyg-embedcode' )
                       .append( $textareaembed )
                       .appendTo( $content );
            // Add video via 'URL'
            var $inputurl = $('<input type="text" value="">').addClass('wysiwyg-input')
                                .keypress(function(event){
                                    if( event.which == 10 || event.which == 13 )
                                        insert_video_wysiwyg( $inputurl.val() );
                                });
            if( placeholder_url )
                $inputurl.prop( 'placeholder', placeholder_url );
            var $okaybutton = $();
            if( toolbar_submit )
                $okaybutton = toolbar_button(toolbar_submit).click(function(event){
                                    insert_video_wysiwyg( $inputurl.val(), $textareaembed.val() );
                                    event.stopPropagation();
                                    event.preventDefault();
                                    return false;
                                });
            $content.append( $('<div/>').append($inputurl).append($okaybutton) );
            return $content;
        };

        // Content: Color palette
        var content_colorpalette = function( wysiwygeditor, forecolor )
        {
            var $content = $('<table/>')
                            .prop('cellpadding','0')
                            .prop('cellspacing','0')
                            .prop('unselectable','on');
            for( var row=1; row < 15; ++row ) // should be '16' - but last line looks so dark
            {
                var $rows = $('<tr/>');
                for( var col=0; col < 25; ++col ) // last column is grayscale
                {
                    var color;
                    if( col == 24 )
                    {
                        var gray = Math.floor(255 / 13 * (14 - row)).toString(16);
                        var hexg = (gray.length < 2 ? '0' : '') + gray;
                        color = '#' + hexg + hexg + hexg;
                    }
                    else
                    {
                        var hue        = col / 24;
                        var saturation = row <= 8 ? row     /8 : 1;
                        var value      = row  > 8 ? (16-row)/8 : 1;
                        color = HSVtoRGB( hue, saturation, value );
                    }
                    $('<td/>').addClass('wysiwyg-toolbar-color')
                              .prop('title', color)
                              .prop('unselectable','on')
                              .css({backgroundColor: color})
                              .click(function(){
                                  var color = this.title;
                                  if( forecolor )
                                      wysiwygeditor.forecolor( color ).closePopup().collapseSelection();
                                  else
                                      wysiwygeditor.highlight( color ).closePopup().collapseSelection();
                                  return false;
                              })
                              .appendTo( $rows );
                }
                $content.append( $rows );
            }
            return $content;
        };

        // Handlers
        var get_toolbar_handler = function( name, popup_callback )
        {
            switch( name )
            {
                case 'insertimage':
                    if( ! popup_callback )
                        return null;
                    return function( target ) {
                        popup_callback( content_insertimage(wysiwygeditor), target );
                    };
                case 'insertvideo':
                    if( ! popup_callback )
                        return null;
                    return function( target ) {
                        popup_callback( content_insertvideo(wysiwygeditor), target );
                    };
                case 'insertlink':
                    if( ! popup_callback )
                        return null;
                    return function( target ) {
                        popup_callback( content_insertlink(wysiwygeditor), target );
                    };
                case 'bold':
                    return function() {
                        wysiwygeditor.bold(); // .closePopup().collapseSelection()
                    };
                case 'italic':
                    return function() {
                        wysiwygeditor.italic(); // .closePopup().collapseSelection()
                    };
                case 'underline':
                    return function() {
                        wysiwygeditor.underline(); // .closePopup().collapseSelection()
                    };
                case 'strikethrough':
                    return function() {
                        wysiwygeditor.strikethrough(); // .closePopup().collapseSelection()
                    };
                case 'forecolor':
                    if( ! popup_callback )
                        return null;
                    return function( target ) {
                        popup_callback( content_colorpalette(wysiwygeditor,true), target );
                    };
                case 'highlight':
                    if( ! popup_callback )
                        return null;
                    return function( target ) {
                        popup_callback( content_colorpalette(wysiwygeditor,false), target );
                    };
                case 'alignleft':
                    return function() {
                        wysiwygeditor.align('left'); // .closePopup().collapseSelection()
                    };
                case 'aligncenter':
                    return function() {
                        wysiwygeditor.align('center'); // .closePopup().collapseSelection()
                    };
                case 'alignright':
                    return function() {
                        wysiwygeditor.align('right'); // .closePopup().collapseSelection()
                    };
                case 'alignjustify':
                    return function() {
                        wysiwygeditor.align('justify'); // .closePopup().collapseSelection()
                    };
                case 'subscript':
                    return function() {
                        wysiwygeditor.subscript(); // .closePopup().collapseSelection()
                    };
                case 'superscript':
                    return function() {
                        wysiwygeditor.superscript(); // .closePopup().collapseSelection()
                    };
                case 'indent':
                    return function() {
                        wysiwygeditor.indent(); // .closePopup().collapseSelection()
                    };
                case 'outdent':
                    return function() {
                        wysiwygeditor.indent(true); // .closePopup().collapseSelection()
                    };
                case 'orderedList':
                    return function() {
                        wysiwygeditor.insertList(true); // .closePopup().collapseSelection()
                    };
                case 'unorderedList':
                    return function() {
                        wysiwygeditor.insertList(); // .closePopup().collapseSelection()
                    };
                case 'removeformat':
                    return function() {
                        wysiwygeditor.removeFormat().closePopup().collapseSelection();
                    };
            }
            return null;
        }

        // Create the toolbar
        var toolbar_button = function( button ) {
            var $element = $('<a/>').addClass( 'wysiwyg-toolbar-icon' )
                                    .prop('href','#')
                                    .prop('unselectable','on')
                                    .append(button.image);
            // pass other properties as "prop()"
            $.each( button, function( name, value )
            {
                switch( name )
                {
                    // classes
                    case 'class':
                        $element.addClass( value );
                        break;
                    // special meaning
                    case 'image':
                    case 'html':
                    case 'popup':
                    case 'click':
                    case 'showstatic':
                    case 'showselection':
                        break;
                    default: // button.title, ...
                        $element.attr( name, value );
                        break;
                }
            });
            return $element;
        };
        var add_buttons_to_toolbar = function( $toolbar, selection, popup_open_callback, popup_position_callback )
        {
            $.each( toolbar_buttons, function(key, value) {
                if( ! value )
                    return ;
                // Skip buttons on the toolbar
                if( selection === false && 'showstatic' in value && ! value.showstatic )
                    return ;
                // Skip buttons on selection
                if( selection === true && 'showselection' in value && ! value.showselection )
                    return ;
                // Click handler
                var toolbar_handler;
                if( 'click' in value )
                    toolbar_handler = function( target ) {
                        value.click( $(target) );
                    };
                else if( 'popup' in value )
                    toolbar_handler = function( target ) {
                        var $popup = popup_open_callback();
                        var overwrite_offset = value.popup( $popup, $(target) );
                        popup_position_callback( $popup, target, overwrite_offset );
                    };
                else
                    toolbar_handler = get_toolbar_handler( key, function( $content, target ) {
                        var $popup = popup_open_callback();
                        $popup.append( $content );
                        popup_position_callback( $popup, target );
                        $popup.find('input[type=text]:first').focus();
                    });
                // Create the toolbar button
                var $button;
                if( toolbar_handler )
                    $button = toolbar_button( value ).click( function(event) {
                        toolbar_handler( event.currentTarget );
                        // Give the focus back to the editor. Technically not necessary
                        if( get_toolbar_handler(key) ) // only if not a popup-handler
                            wysiwygeditor.getElement().focus();
                        event.stopPropagation();
                        event.preventDefault();
                        return false;
                    });
                else if( value.html )
                    $button = $(value.html);
                if( $button )
                    $toolbar.append( $button );
            });
        };
        var popup_position = function( $popup, $container, left, top )  // left+top relative to $container
        {
            // Test parents
            var container_node = $container.get(0),
                offsetparent = container_node.offsetParent,
                offsetparent_left = 0,
                offsetparent_top = 0,
                offsetparent_break = false,
                offsetparent_window_left = 0,     //$.offset() does not work with Safari 3 and 'position:fixed'
                offsetparent_window_top = 0,
                offsetparent_fixed = false,
                offsetparent_overflow = false,
                popup_width = $popup.width(),
                node = offsetparent;
            while( node )
            {
                offsetparent_window_left += node.offsetLeft;
                offsetparent_window_top += node.offsetTop;
                var $node = $(node),
                    node_position = $node.css('position');
                if( node_position != 'static' )
                    offsetparent_break = true;
                else if( ! offsetparent_break )
                {
                    offsetparent_left += node.offsetLeft;
                    offsetparent_top += node.offsetTop;
                }
                if( node_position == 'fixed' )
                    offsetparent_fixed = true;
                if( $node.css('overflow') != 'visible' )
                    offsetparent_overflow = true;
                node = node.offsetParent;
            }
            // Move $popup as high as possible in the DOM tree: offsetParent of $container
            var $offsetparent = $(offsetparent || document.body);
            $offsetparent.append( $popup );
            left += offsetparent_left + container_node.offsetLeft; // $container.position() does not work with Safari 3
            top += offsetparent_top + container_node.offsetTop;
            // Trim to offset-parent
            if( offsetparent_fixed || offsetparent_overflow )
            {
                if( left + popup_width > $offsetparent.width() - 1 )
                    left = $offsetparent.width() - popup_width - 1;
                if( left < 1 )
                    left = 1;
            }
            // Trim to viewport
            var viewport_width = $(window).width();
            if( offsetparent_window_left + left + popup_width > viewport_width - 1 )
                left = viewport_width - offsetparent_window_left - popup_width - 1;
            var scroll_left = offsetparent_fixed ? 0 : $(window).scrollLeft();
            if( offsetparent_window_left + left < scroll_left + 1 )
                left = scroll_left - offsetparent_window_left + 1;
            // Set offset
            $popup.css({ left: parseInt(left) + 'px',
                         top: parseInt(top) + 'px' });
        };


        // Transform the textarea to contenteditable
        var hotkeys = {},
            autocomplete = null;
        var create_wysiwyg = function( $textarea, $editor, $container, $placeholder )
        {
            var handle_autocomplete = function( keypress, key, character, shiftKey, altKey, ctrlKey, metaKey )
            {
                if( ! on_autocomplete )
                    return ;
                var typed = autocomplete || '';
                switch( key )
                {
                    case  8: // backspace
                        typed = typed.substring( 0, typed.length - 1 );
                        // fall through
                    case 13: // enter
                    case 27: // escape
                    case 33: // pageUp
                    case 34: // pageDown
                    case 35: // end
                    case 36: // home
                    case 37: // left
                    case 38: // up
                    case 39: // right
                    case 40: // down
                        if( keypress )
                            return ;
                        character = false;
                        break;
                    default:
                        if( ! keypress )
                            return ;
                        typed += character;
                        break;
                }
                var rc = on_autocomplete( typed, key, character, shiftKey, altKey, ctrlKey, metaKey );
                if( typeof(rc) == 'object' && rc.length )
                {
                    // Show autocomplete
                    var $popup = $(wysiwygeditor.openPopup());
                    $popup.hide().addClass( 'wysiwyg-popup wysiwyg-popuphover' ) // show later
                          .empty().append( rc );
                    autocomplete = typed;
                }
                else
                {
                    // Hide autocomplete
                    wysiwygeditor.closePopup();
                    autocomplete = null;
                    return rc; // swallow key if 'false'
                }
            };

            // Options to wysiwyg.js
            var option = {
                element: $textarea.get(0),
                contenteditable: $editor ? $editor.get(0) : null,
                onKeyDown: function( key, character, shiftKey, altKey, ctrlKey, metaKey )
                    {
                        // Ask master
                        if( on_keydown && on_keydown(key, character, shiftKey, altKey, ctrlKey, metaKey) === false )
                            return false; // swallow key
                        // Exec hotkey (onkeydown because e.g. CTRL+B would oben the bookmarks)
                        if( character && !shiftKey && !altKey && ctrlKey && !metaKey )
                        {
                            var hotkey = character.toLowerCase();
                            if( ! hotkeys[hotkey] )
                                return ;
                            hotkeys[hotkey]();
                            return false; // prevent default
                        }
                        // Handle autocomplete
                        return handle_autocomplete( false, key, character, shiftKey, altKey, ctrlKey, metaKey );
                    },
                onKeyPress: function( key, character, shiftKey, altKey, ctrlKey, metaKey )
                    {
                        // Ask master
                        if( on_keypress && on_keypress(key, character, shiftKey, altKey, ctrlKey, metaKey) === false )
                            return false; // swallow key
                        // Handle autocomplete
                        return handle_autocomplete( true, key, character, shiftKey, altKey, ctrlKey, metaKey );
                    },
                onKeyUp: function( key, character, shiftKey, altKey, ctrlKey, metaKey )
                    {
                        // Ask master
                        if( on_keyup && on_keyup(key, character, shiftKey, altKey, ctrlKey, metaKey) === false )
                            return false; // swallow key
                    },
                onSelection: function( collapsed, rect, nodes, rightclick )
                    {
                        var show_popup = true,
                            $special_popup = null;
                        // Click on a link opens the link-popup
                        if( collapsed )
                            $.each( nodes, function(index, node) {
                                var $link = $(node).closest('a');
                                if( $link.length != 0 ) { // only clicks on text-nodes
                                    $special_popup = content_insertlink( wysiwygeditor, $link )
                                    return false; // break
                                }
                            });
                        // Read-Only?
                        if( wysiwygeditor.readOnly() )
                            show_popup = false;
                        // Fix type error - https://github.com/wysiwygjs/wysiwyg.js/issues/4
                        else if( ! rect )
                            show_popup = false;
                        // Force a special popup?
                        else if( $special_popup )
                            ;
                        // A right-click always opens the popup
                        else if( rightclick )
                            ;
                        // Autocomplete popup?
                        else if( autocomplete )
                            ;
                        // No selection-popup wanted?
                        else if( $.inArray('selection',toolbar_position.split('-')) == -1 )
                            show_popup = false;
                        // Selected popup wanted, but nothing selected (=selection collapsed)
                        else if( collapsed )
                            show_popup = false;
                        // Only one image? Better: Display a special image-popup
                        else if( nodes.length == 1 && nodes[0].nodeName == 'IMG' ) // nodes is not a sparse array
                            show_popup = false;
                        if( ! show_popup )
                        {
                            wysiwygeditor.closePopup();
                            return ;
                        }
                        // Popup position
                        var $popup;
                        var apply_popup_position = function()
                        {
                            var popup_width = $popup.outerWidth();
                            // Point is the center of the selection - relative to $parent not the element
                            var $parent = $textarea.parent(),
                                container_offset = $parent.offset(),
                                editor_offset = $(wysiwygeditor.getElement()).offset();
                            var left = rect.left + parseInt(rect.width / 2) - parseInt(popup_width / 2) + editor_offset.left - container_offset.left;
                            var top = rect.top + rect.height + editor_offset.top - container_offset.top;
                            popup_position( $popup, $parent, left, top );
                        };
                        // Open popup
                        $popup = $(wysiwygeditor.openPopup());
                        // if wrong popup -> close and open a new one
                        if( ! $popup.hasClass('wysiwyg-popuphover') || (!$popup.data('wysiwygjs-special')) != (!$special_popup) )
                            $popup = $(wysiwygeditor.closePopup().openPopup());
                        if( autocomplete )
                            $popup.show();
                        else if( ! $popup.hasClass('wysiwyg-popup') )
                        {
                            // add classes + buttons
                            $popup.addClass( 'wysiwyg-popup wysiwyg-popuphover' );
                            if( $special_popup )
                                $popup.empty().append( $special_popup ).data('wysiwygjs-special',true);
                            else
                                add_buttons_to_toolbar( $popup, true,
                                    function() {
                                        return $popup.empty();
                                    },
                                    apply_popup_position );
                        }
                        // Apply position
                        apply_popup_position();
                    },
                onOpenpopup: function() {
                        add_class_active();
                    },
                onClosepopup: function() {
                        autocomplete = null;
                        remove_class_active();
                    },
                hijackContextmenu: (toolbar_position == 'selection'),
                readOnly: !!$textarea.prop( 'readonly' )
            };
            if( $placeholder )
            {
                option.onPlaceholder = function( visible ) {
                    if( visible )
                        $placeholder.show();
                    else
                        $placeholder.hide();
                };
            }

            var wysiwygeditor = wysiwyg( option );
            return wysiwygeditor;
        }


        // Create a container if it does not exist yet
        var $container = $textarea.closest( '.wysiwyg-container' );
        if( $container.length == 0 )
        {
            $container = $('<div/>').addClass('wysiwyg-container');
            if( classes )
                $container.addClass( classes );
            $textarea.wrap( $container );
            $container = $textarea.closest( '.wysiwyg-container' );
        }

        // Create the placeholder if it does not exist yet and we want one
        var $wrapper = $textarea.closest( '.wysiwyg-wrapper' );
        if( placeholder && $wrapper.length == 0 )
        {
            $wrapper = $('<div/>').addClass('wysiwyg-wrapper');
            $textarea.wrap( $wrapper );
            $wrapper = $textarea.closest( '.wysiwyg-wrapper' );
        }
        var $placeholder = null;
        if( $wrapper.length != 0 )
            $placeholder = $wrapper.find( '.wysiwyg-placeholder' );
        if( placeholder && (! $placeholder || $placeholder.length == 0) )
        {
            $placeholder = $('<div/>').addClass( 'wysiwyg-placeholder' )
                                      .html( placeholder )
                                      .hide();
            $wrapper.prepend( $placeholder );
        }

        // Create the WYSIWYG Editor
        var $editor = $container.find( '.wysiwyg-editor' );
        if( $editor.length == 0 )
            $editor = null;
        var wysiwygeditor = create_wysiwyg( $textarea, $editor, $container, $placeholder );
        if( wysiwygeditor.legacy )
        {
            if( $editor )
                $editor.hide();
            if( $placeholder )
                $placeholder.hide();
            var $textarea = $(wysiwygeditor.getElement());
            $textarea.show().addClass( 'wysiwyg-textarea' );
            if( $textarea.is(':visible') ) // inside the DOM
                $textarea.width( $container.width() - ($textarea.outerWidth() - $textarea.width()) );
        }
        else
        {
            if( ! $editor )
                $(wysiwygeditor.getElement()).addClass( 'wysiwyg-editor' );

            // Clicking the placeholder -> focus editor - fixes IE6-IE8
            $wrapper.click(function(){
                wysiwygeditor.getElement().focus();
            });

            // Support ':active'-class
            var remove_active_timeout = null,
                initialize_toolbar = null;
            var add_class_active = function() {
                if( remove_active_timeout )
                    clearTimeout( remove_active_timeout );
                remove_active_timeout = null;
                if( initialize_toolbar )
                {
                    initialize_toolbar();
                    initialize_toolbar = null;
                }
                $container.addClass( 'wysiwyg-active' );
                $container.find( '.wysiwyg-toolbar-focus' ).slideDown(200);
            };
            var remove_class_active = function() {
                if( remove_active_timeout || document.activeElement == wysiwygeditor.getElement() )
                    return ;
                remove_active_timeout = setTimeout( function() {
                    remove_active_timeout = null;
                    $container.removeClass( 'wysiwyg-active' );
                    if( $.trim(wysiwygeditor.getHTML().replace(/<br\s*[\/]?>/gi,'')).length == 0 )
                        $container.find( '.wysiwyg-toolbar-focus' ).slideUp(200);
                }, 100 );
            };
            $(wysiwygeditor.getElement()).focus( add_class_active ).blur( remove_class_active );
            $textarea.closest( 'form' ).on( 'reset', remove_class_active );

            // Hotkey+Commands-List
            var commands = {};
            $.each( toolbar_buttons, function(key, value) {
                if( ! value || ! value.hotkey )
                    return ;
                var toolbar_handler = get_toolbar_handler( key );
                if( ! toolbar_handler )
                    return ;
                hotkeys[value.hotkey.toLowerCase()] = toolbar_handler;
                commands[key] = toolbar_handler;
            });

            // Toolbar on top or bottom
            if( ! $.isEmptyObject(toolbar_buttons) && toolbar_position != 'selection' )
            {
                var toolbar_top = $.inArray( 'top', toolbar_position.split('-') ) != -1;
                var toolbar_focus = $.inArray( 'focus', toolbar_position.split('-') ) != -1;
                // Callback to create toolbar on demand
                var create_toolbar = function()
                {
                    var $toolbar = $('<div/>').addClass( 'wysiwyg-toolbar' ).addClass( toolbar_top ? 'wysiwyg-toolbar-top' : 'wysiwyg-toolbar-bottom' );
                    if( toolbar_focus )
                        $toolbar.hide().addClass( 'wysiwyg-toolbar-focus' );
                    // Add buttons to the toolbar
                    add_buttons_to_toolbar( $toolbar, false,
                        function() {
                            // Open a popup from the toolbar
                            var $popup = $(wysiwygeditor.openPopup());
                            // if wrong popup -> create a new one
                            if( $popup.hasClass('wysiwyg-popup') && $popup.hasClass('wysiwyg-popuphover') )
                                $popup = $(wysiwygeditor.closePopup().openPopup());
                            if( ! $popup.hasClass('wysiwyg-popup') )
                                // add classes + content
                                $popup.addClass( 'wysiwyg-popup' );
                            return $popup;
                        },
                        function( $popup, target, overwrite_offset ) {
                            // Popup position
                            var $button = $(target);
                            var popup_width = $popup.outerWidth();
                            // Point is the top/bottom-center of the button
                            var left = $button.offset().left - $container.offset().left + parseInt($button.width() / 2) - parseInt(popup_width / 2);
                            var top = $button.offset().top - $container.offset().top;
                            if( toolbar_top )
                                top += $button.outerHeight();
                            else
                                top -= $popup.outerHeight();
                            if( overwrite_offset )
                            {
                                left = overwrite_offset.left;
                                top = overwrite_offset.top;
                            }
                            popup_position( $popup, $container, left, top );
                        });
                    if( toolbar_top )
                        $container.prepend( $toolbar );
                    else
                        $container.append( $toolbar );
                };
                if( ! toolbar_focus )
                    create_toolbar();
                else
                    initialize_toolbar = create_toolbar;
            }
        }

        // Export userdata
        return {
            wysiwygeditor: wysiwygeditor,
            $container: $container
        };
    };

    // jQuery Interface
    $.fn.wysiwyg = function( option, param )
    {
        if( ! option || typeof(option) === 'object' )
        {
            option = $.extend( {}, option );
            return this.each(function() {
                var $that = $(this);
                // Already an editor
                if( $that.data( 'wysiwygjs') )
                    return ;

                // Two modes: toolbar on top and on bottom
                var classes = option['class'],
                    placeholder = option.placeholder || $that.prop('placeholder'),
                    toolbar_position = option.toolbar || 'top',
                    toolbar_buttons = option.buttons || {},
                    toolbar_submit = option.submit,
                    label_selectImage = option.selectImage,
                    placeholder_url = option.placeholderUrl || null,
                    placeholder_embed = option.placeholderEmbed || null,
                    max_imagesize = option.maxImageSize || null,
                    filter_imageType = option.filterImageType || '^image/',
                    on_imageupload = option.onImageUpload || null,
                    force_imageupload = option.forceImageUpload && on_imageupload,
                    video_from_url = option.videoFromUrl || null,
                    on_keydown = option.onKeyDown || null,
                    on_keypress = option.onKeyPress || null,
                    on_keyup = option.onKeyUp || null,
                    on_autocomplete = option.onAutocomplete || null;

                // Create the WYSIWYG Editor
                var data = create_editor( $that, classes, placeholder, toolbar_position, toolbar_buttons, toolbar_submit, label_selectImage,
                                          placeholder_url, placeholder_embed, max_imagesize, filter_imageType, on_imageupload, force_imageupload, video_from_url,
                                          on_keydown, on_keypress, on_keyup, on_autocomplete );
                $that.data( 'wysiwygjs', data );
            });
        }
        else if( this.length == 1 )
        {
            var data = this.data('wysiwygjs');
            if( ! data )
                return this;
            if( option == 'container' )
                return data.$container;
            if( option == 'shell' )
                return data.wysiwygeditor;
        }
        return this;
    };
});

(function(factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define([], function(){
            return factory(window, document);
        });
    } else if (typeof exports !== 'undefined') {
        module.exports = factory(window, document);
    } else {
        window.wysiwyg = factory(window, document);
    }
})(function(window, document){
    'use strict';

    // http://stackoverflow.com/questions/97962/debounce-clicks-when-submitting-a-web-form
    var debounce = function( callback, wait, cancelprevious )
    {
        var timeout;
        return function()
        {
            if( timeout )
            {
                if( ! cancelprevious )
                    return ;
                clearTimeout( timeout );
            }
            var context = this,
                args = arguments;
            timeout = setTimeout(
                function()
                {
                    timeout = null;
                    callback.apply( context, args );
                }, wait );
        };
    };

    // http://stackoverflow.com/questions/12949590/how-to-detach-event-in-ie-6-7-8-9-using-javascript
    var addEvent = function( element, type, handler, useCapture )
    {
        if( element.addEventListener ) {
            element.addEventListener( type, handler, useCapture ? true : false );
        }
        else if( element.attachEvent ) {
            element.attachEvent( 'on' + type, handler );
        }
        else if( element != window )
            element['on' + type] = handler;
    };
    var removeEvent = function( element, type, handler, useCapture )
    {
        if( element.removeEventListener ) {
            element.removeEventListener( type, handler, useCapture ? true : false );
        }
        else if( element.detachEvent) {
            element.detachEvent( 'on' + type, handler );
        }
        else if( element != window )
            element['on' + type] = null;
    };
    // http://www.cristinawithout.com/content/function-trigger-events-javascript
    var fireEvent = function( element, type, bubbles, cancelable )
    {
        if( document.createEvent ) {
            var event = document.createEvent('Event');
            event.initEvent( type, bubbles !== undefined ? bubbles : true, cancelable !== undefined ? cancelable : false );
            element.dispatchEvent(event);
        }
        else if( document.createEventObject ) { //IE
            var event = document.createEventObject();
            element.fireEvent( 'on' + type, event );
        }
        else if( typeof(element['on' + type]) == 'function' )
            element['on' + type]();
    };
    // prevent default
    var cancelEvent = function( e )
    {
        if( e.preventDefault )
            e.preventDefault();
        else
            e.returnValue = false;
        if( e.stopPropagation )
            e.stopPropagation();
        else
            e.cancelBubble = true;
        return false;
    };

    // http://stackoverflow.com/questions/13377887/javascript-node-undefined-in-ie8-and-under
    var Node_ELEMENT_NODE = typeof(Node) != 'undefined' ? Node.ELEMENT_NODE : 1;
    var Node_TEXT_NODE = typeof(Node) != 'undefined' ? Node.TEXT_NODE : 3;

    // http://stackoverflow.com/questions/2234979/how-to-check-in-javascript-if-one-element-is-a-child-of-another
    var isOrContainsNode = function( ancestor, descendant )
    {
        var node = descendant;
        while( node )
        {
            if( node === ancestor )
                return true;
            node = node.parentNode;
        }
        return false;
    };

    // http://stackoverflow.com/questions/667951/how-to-get-nodes-lying-inside-a-range-with-javascript
    var nextNode = function( node, container )
    {
        if( node.firstChild )
            return node.firstChild;
        while( node )
        {
            if( node == container ) // do not walk out of the container
                return null;
            if( node.nextSibling )
                return node.nextSibling;
            node = node.parentNode;
        }
        return null;
    };

    // save/restore selection
    // http://stackoverflow.com/questions/13949059/persisting-the-changes-of-range-objects-after-selection-in-html/13950376#13950376
    var saveSelection = function( containerNode )
    {
        if( window.getSelection )
        {
            var sel = window.getSelection();
            if( sel.rangeCount > 0 )
                return sel.getRangeAt(0);
        }
        else if( document.selection )
        {
            var sel = document.selection;
            return sel.createRange();
        }
        return null;
    };
    var restoreSelection = function( containerNode, savedSel )
    {
        if( ! savedSel )
            return;
        if( window.getSelection )
        {
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedSel);
        }
        else if( document.selection )
        {
            savedSel.select();
        }
    };

    // http://stackoverflow.com/questions/12603397/calculate-width-height-of-the-selected-text-javascript
    // http://stackoverflow.com/questions/6846230/coordinates-of-selected-text-in-browser-page
    var getSelectionRect = function()
    {
        if( window.getSelection )
        {
            var sel = window.getSelection();
            if( ! sel.rangeCount )
                return false;
            var range = sel.getRangeAt(0).cloneRange();
            if( range.getBoundingClientRect ) // Missing for Firefox 3.5+3.6
            {
                var rect = range.getBoundingClientRect();
                // Safari 5.1 returns null, IE9 returns 0/0/0/0 if image selected
                if( rect && rect.left && rect.top && rect.right && rect.bottom )
                    return {
                        // Modern browsers return floating-point numbers
                        left: parseInt(rect.left),
                        top: parseInt(rect.top),
                        width: parseInt(rect.right - rect.left),
                        height: parseInt(rect.bottom - rect.top)
                    };
                // on Webkit 'range.getBoundingClientRect()' sometimes return 0/0/0/0 - but 'range.getClientRects()' works
                var rects = range.getClientRects ? range.getClientRects() : [];
                for( var i=0; i < rects.length; ++i )
                {
                    var rect = rects[i];
                    if( rect.left && rect.top && rect.right && rect.bottom )
                        return {
                            // Modern browsers return floating-point numbers
                            left: parseInt(rect.left),
                            top: parseInt(rect.top),
                            width: parseInt(rect.right - rect.left),
                            height: parseInt(rect.bottom - rect.top)
                        };
                }
            }
            /*
            // Fall back to inserting a temporary element (only for Firefox 3.5 and 3.6)
            var span = document.createElement('span');
            if( span.getBoundingClientRect )
            {
                // Ensure span has dimensions and position by
                // adding a zero-width space character
                span.appendChild( document.createTextNode('\u200b') );
                range.insertNode( span );
                var rect = span.getBoundingClientRect();
                var spanParent = span.parentNode;
                spanParent.removeChild( span );
                // Glue any broken text nodes back together
                spanParent.normalize();
                return {
                    left: parseInt(rect.left),
                    top: parseInt(rect.top),
                    width: parseInt(rect.right - rect.left),
                    height: parseInt(rect.bottom - rect.top)
                };
            }
            */
        }
        else if( document.selection )
        {
            var sel = document.selection;
            if( sel.type != 'Control' )
            {
                var range = sel.createRange();
                // IE8 return 0/0/0/0 if caret right before newline
                if( range.boundingLeft || range.boundingTop || range.boundingWidth || range.boundingHeight )
                    return {
                        left: range.boundingLeft,
                        top: range.boundingTop,
                        width: range.boundingWidth,
                        height: range.boundingHeight
                    };
            }
        }
        return false;
    };

    var getSelectionCollapsed = function( containerNode )
    {
        if( window.getSelection )
        {
            var sel = window.getSelection();
            if( sel.isCollapsed )
                return true;
            return false;
        }
        else if( document.selection )
        {
            var sel = document.selection;
            if( sel.type == 'Text' )
            {
                var range = document.selection.createRange();
                var textrange = document.body.createTextRange();
                textrange.moveToElementText(containerNode);
                textrange.setEndPoint('EndToStart', range);
                return range.htmlText.length == 0;
            }
            if( sel.type == 'Control' ) // e.g. an image selected
                return false;
            // sel.type == 'None' -> collapsed selection
        }
        return true;
    };

    // http://stackoverflow.com/questions/7781963/js-get-array-of-all-selected-nodes-in-contenteditable-div
    var getSelectedNodes = function( containerNode )
    {
        if( window.getSelection )
        {
            var sel = window.getSelection();
            if( ! sel.rangeCount )
                return [];
            var nodes = [];
            for( var i=0; i < sel.rangeCount; ++i )
            {
                var range = sel.getRangeAt(i),
                    node = range.startContainer,
                    endNode = range.endContainer;
                while( node )
                {
                    // add this node?
                    if( node != containerNode )
                    {
                        var node_inside_selection = false;
                        if( sel.containsNode )
                            node_inside_selection = sel.containsNode( node, true );
                        else // IE11
                        {
                            // http://stackoverflow.com/questions/5884210/how-to-find-if-a-htmlelement-is-enclosed-in-selected-text
                            var noderange = document.createRange();
                            noderange.selectNodeContents( node );
                            for( var i=0; i < sel.rangeCount; ++i )
                            {
                                var range = sel.getRangeAt(i);
                                // start after or end before -> skip node
                                if( range.compareBoundaryPoints(range.END_TO_START,noderange) >= 0 &&
                                    range.compareBoundaryPoints(range.START_TO_END,noderange) <= 0 )
                                {
                                    node_inside_selection = true;
                                    break;
                                }
                            }
                        }
                        if( node_inside_selection )
                            nodes.push( node );
                    }
                    node = nextNode( node, node == endNode ? endNode : containerNode );
                }
            }
            // Fallback
            if( nodes.length == 0 && isOrContainsNode(containerNode,sel.focusNode) && sel.focusNode != containerNode )
                nodes.push( sel.focusNode );
            return nodes;
        }
        else if( document.selection )
        {
            var sel = document.selection;
            if( sel.type == 'Text' )
            {
                var nodes = [];
                var ranges = sel.createRangeCollection();
                for( var i=0; i < ranges.length; ++i )
                {
                    var range = ranges[i],
                        parentNode = range.parentElement(),
                        node = parentNode;
                    while( node )
                    {
                        // No clue how to detect whether a TextNode is within the selection...
                        // ElementNode is easy: http://stackoverflow.com/questions/5884210/how-to-find-if-a-htmlelement-is-enclosed-in-selected-text
                        var noderange = range.duplicate();
                        noderange.moveToElementText( node.nodeType != Node_ELEMENT_NODE ? node.parentNode : node );
                        // start after or end before -> skip node
                        if( noderange.compareEndPoints('EndToStart',range) >= 0 &&
                            noderange.compareEndPoints('StartToEnd',range) <= 0 )
                        {
                            // no "Array.indexOf()" in IE8
                            var in_array = false;
                            for( var j=0; j < nodes.length; ++j )
                            {
                                if( nodes[j] !== node )
                                    continue;
                                in_array = true;
                                break;
                            }
                            if( ! in_array )
                                nodes.push( node );
                        }
                        node = nextNode( node, parentNode );
                    }
                }
                // Fallback
                if( nodes.length == 0 && isOrContainsNode(containerNode,document.activeElement) && document.activeElement != containerNode )
                    nodes.push( document.activeElement );
                return nodes;
            }
            if( sel.type == 'Control' ) // e.g. an image selected
            {
                var nodes = [];
                // http://msdn.microsoft.com/en-us/library/ie/hh826021%28v=vs.85%29.aspx
                var range = sel.createRange();
                for( var i=0; i < range.length; ++i )
                    nodes.push( range(i) );
                return nodes;
            }
        }
        return [];
    };

    // http://stackoverflow.com/questions/8513368/collapse-selection-to-start-of-selection-not-div
    var collapseSelectionEnd = function()
    {
        if( window.getSelection )
        {
            var sel = window.getSelection();
            if( ! sel.isCollapsed )
            {
                // Form-submits via Enter throw 'NS_ERROR_FAILURE' on Firefox 34
                try {
                    sel.collapseToEnd();
                }
                catch( e ) {
                }
            }
        }
        else if( document.selection )
        {
            var sel = document.selection;
            if( sel.type != 'Control' )
            {
                var range = sel.createRange();
                range.collapse(false);
                range.select();
            }
        }
    };

    // http://stackoverflow.com/questions/15157435/get-last-character-before-caret-position-in-javascript
    // http://stackoverflow.com/questions/11247737/how-can-i-get-the-word-that-the-caret-is-upon-inside-a-contenteditable-div
    var expandSelectionCaret = function( containerNode, preceding, following )
    {
        if( window.getSelection )
        {
            var sel = window.getSelection();
            if( sel.modify )
            {
                for( var i=0; i < preceding; ++i )
                    sel.modify('extend', 'backward', 'character');
                for( var i=0; i < following; ++i )
                    sel.modify('extend', 'forward', 'character');
            }
            else
            {
                // not so easy if the steps would cover multiple nodes ...
                var range = sel.getRangeAt(0);
                range.setStart( range.startContainer, range.startOffset - preceding );
                range.setEnd( range.endContainer, range.endOffset + following );
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
        else if( document.selection )
        {
            var sel = document.selection;
            if( sel.type != 'Control' )
            {
                var range = sel.createRange();
                range.collapse(true);
                range.moveStart('character', -preceding);
                range.moveEnd('character', following);
                range.select();
            }
        }
    };

    // http://stackoverflow.com/questions/4652734/return-html-from-a-user-selected-text/4652824#4652824
    var getSelectionHtml = function( containerNode )
    {
        if( getSelectionCollapsed( containerNode ) )
            return null;
        if( window.getSelection )
        {
            var sel = window.getSelection();
            if( sel.rangeCount )
            {
                var container = document.createElement('div'),
                    len = sel.rangeCount;
                for( var i=0; i < len; ++i )
                {
                    var contents = sel.getRangeAt(i).cloneContents();
                    container.appendChild(contents);
                }
                return container.innerHTML;
            }
        }
        else if( document.selection )
        {
            var sel = document.selection;
            if( sel.type == 'Text' )
            {
                var range = sel.createRange();
                return range.htmlText;
            }
        }
        return null;
    };

    var selectionInside = function( containerNode, force )
    {
        // selection inside editor?
        if( window.getSelection )
        {
            var sel = window.getSelection();
            if( isOrContainsNode(containerNode,sel.anchorNode) && isOrContainsNode(containerNode,sel.focusNode) )
                return true;
            // selection at least partly outside editor
            if( ! force )
                return false;
            // force selection to editor
            var range = document.createRange();
            range.selectNodeContents( containerNode );
            range.collapse( false );
            sel.removeAllRanges();
            sel.addRange(range);
        }
        else if( document.selection )
        {
            var sel = document.selection;
            if( sel.type == 'Control' ) // e.g. an image selected
            {
                // http://msdn.microsoft.com/en-us/library/ie/hh826021%28v=vs.85%29.aspx
                var range = sel.createRange();
                if( range.length != 0 && isOrContainsNode(containerNode,range(0)) ) // test only the first element
                    return true;
            }
            else //if( sel.type == 'Text' || sel.type == 'None' )
            {
                // Range of container
                // http://stackoverflow.com/questions/12243898/how-to-select-all-text-in-contenteditable-div
                var rangeContainer = document.body.createTextRange();
                rangeContainer.moveToElementText(containerNode);
                // Compare with selection range
                var range = sel.createRange();
                if( rangeContainer.inRange(range) )
                    return true;
            }
            // selection at least partly outside editor
            if( ! force )
                return false;
            // force selection to editor
            // http://stackoverflow.com/questions/12243898/how-to-select-all-text-in-contenteditable-div
            var range = document.body.createTextRange();
            range.moveToElementText(containerNode);
            range.setEndPoint('StartToEnd',range); // collapse
            range.select();
        }
        return true;
    };

    /*
    var clipSelectionTo = function( containerNode )
    {
        if( window.getSelection && containerNode.compareDocumentPosition )
        {
            var sel = window.getSelection();
            var left_node = sel.anchorNode,
                left_offset = sel.anchorOffset,
                right_node = sel.focusNode,
                right_offset = sel.focusOffset;
            // http://stackoverflow.com/questions/10710733/dom-determine-if-the-anchornode-or-focusnode-is-on-the-left-side
            if( (left_node == right_node && left_offset > right_offset) ||
                (left_node.compareDocumentPosition(right_node) & Node.DOCUMENT_POSITION_PRECEDING) )
            {
                // Right-to-left selection
                left_node = sel.focusNode;
                left_offset = sel.focusOffset;
                right_node = sel.anchorNode,
                right_offset = sel.anchorOffset;
            }
            // Speed up: selection inside editor
            var left_inside = isOrContainsNode(containerNode,left_node),
                right_inside = isOrContainsNode(containerNode,right_node);
            if( left_inside && right_inside )
                return true;
            // Selection before/after container?
            if( ! left_inside && containerNode.compareDocumentPosition(left_node) & Node.DOCUMENT_POSITION_FOLLOWING )
                return false; // selection after
            if( ! right_inside && containerNode.compareDocumentPosition(right_node) & Node.DOCUMENT_POSITION_PRECEDING )
                return false; // selection before
            // Selection partly before/after container
            // http://stackoverflow.com/questions/12243898/how-to-select-all-text-in-contenteditable-div
            var range = document.createRange();
            range.selectNodeContents( containerNode );
            if( left_inside )
                range.setStart( left_node, left_offset );
            if( right_inside )
                range.setEnd( right_node, right_offset );
            sel.removeAllRanges();
            sel.addRange(range);
            return true;
        }
        else if( document.selection )
        {
            var sel = document.selection;
            if( sel.type == 'Text' )
            {
                // Range of container
                // http://stackoverflow.com/questions/12243898/how-to-select-all-text-in-contenteditable-div
                var rangeContainer = document.body.createTextRange();
                rangeContainer.moveToElementText(containerNode);
                // Compare with selection range
                var range = sel.createRange();
                if( rangeContainer.inRange(range) )
                    return true;
                // Selection before/after container?
                if( rangeContainer.compareEndPoints('StartToEnd',range) > 0 )
                    return false;
                if( rangeContainer.compareEndPoints('EndToStart',range) < 0 )
                    return false;
                // Selection partly before/after container
                if( rangeContainer.compareEndPoints('StartToStart',range) > 0 )
                    range.setEndPoint('StartToStart',rangeContainer);
                if( rangeContainer.compareEndPoints('EndToEnd',range) < 0 )
                    range.setEndPoint('EndToEnd',rangeContainer);
                // select range
                range.select();
                return true;
            }
        }
        return true;
    };
    */

    // http://stackoverflow.com/questions/6690752/insert-html-at-caret-in-a-contenteditable-div/6691294#6691294
    // http://stackoverflow.com/questions/4823691/insert-an-html-element-in-a-contenteditable-element
    // http://stackoverflow.com/questions/6139107/programatically-select-text-in-a-contenteditable-html-element
    var pasteHtmlAtCaret = function( containerNode, html )
    {
        if( window.getSelection )
        {
            // IE9 and non-IE
            var sel = window.getSelection();
            if( sel.getRangeAt && sel.rangeCount )
            {
                var range = sel.getRangeAt(0);
                // Range.createContextualFragment() would be useful here but is
                // only relatively recently standardized and is not supported in
                // some browsers (IE9, for one)
                var el = document.createElement('div');
                el.innerHTML = html;
                var frag = document.createDocumentFragment(), node, lastNode;
                while ( (node = el.firstChild) ) {
                    lastNode = frag.appendChild(node);
                }
                if( isOrContainsNode(containerNode, range.commonAncestorContainer) )
                {
                    range.deleteContents();
                    range.insertNode(frag);
                }
                else {
                    containerNode.appendChild(frag);
                }
                // Preserve the selection
                if( lastNode )
                {
                    range = range.cloneRange();
                    range.setStartAfter(lastNode);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        }
        else if( document.selection )
        {
            // IE <= 8
            var sel = document.selection;
            if( sel.type != 'Control' )
            {
                var originalRange = sel.createRange();
                originalRange.collapse(true);
                var range = sel.createRange();
                if( isOrContainsNode(containerNode, range.parentElement()) )
                    range.pasteHTML( html );
                else // simply append to Editor
                {
                    var textRange = document.body.createTextRange();
                    textRange.moveToElementText(containerNode);
                    textRange.collapse(false);
                    textRange.select();
                    textRange.pasteHTML( html );
                }
                // Preserve the selection
                range = sel.createRange();
                range.setEndPoint('StartToEnd', originalRange);
                range.select();
            }
        }
    };

    // Interface: Create wysiwyg
    var wysiwyg = function( option )
    {
        // Options
        option = option || {};
        var option_element = option.element || null;
        if( typeof(option_element) == 'string' )
            option_element = document.getElementById( option_element );
        var option_contenteditable = option.contenteditable || null;
        if( typeof(option_contenteditable) == 'string' )
            option_contenteditable = document.getElementById( option_contenteditable );
        var option_onkeydown = option.onKeyDown || null;
        var option_onkeypress = option.onKeyPress || null;
        var option_onkeyup = option.onKeyUp || null;
        var option_onselection = option.onSelection || null;
        var option_onplaceholder = option.onPlaceholder || null;
        var option_onopenpopup = option.onOpenpopup || null;
        var option_onclosepopup = option.onClosepopup || null;
        var option_hijackcontextmenu = option.hijackContextmenu || false;
        var option_readonly = option.readOnly || false;

        // Keep textarea if browser can't handle content-editable
        var is_textarea = option_element.nodeName == 'TEXTAREA' || option_element.nodeName == 'INPUT';
        if( is_textarea )
        {
            // http://stackoverflow.com/questions/1882205/how-do-i-detect-support-for-contenteditable-via-javascript
            var canContentEditable = 'contentEditable' in document.body;
            if( canContentEditable )
            {
                // Sniffer useragent...
                var webkit = navigator.userAgent.match(/(?:iPad|iPhone|Android).* AppleWebKit\/([^ ]+)/);
                if( webkit && 420 <= parseInt(webkit[1]) && parseInt(webkit[1]) < 534 ) // iPhone 1 was Webkit/420
                    canContentEditable = false;
            }
            if( ! canContentEditable )
            {
                // Keep textarea
                var node_textarea = option_element;
                // Add a 'newline' after each '<br>'
                var newlineAfterBR = function( html ) {
                    return html.replace(/<br[ \/]*>\n?/gi,'<br>\n');
                };
                node_textarea.value = newlineAfterBR( node_textarea.value );
                // Command structure
                var dummy_this = function() {
                    return this;
                };
                var dummy_null = function() {
                    return null;
                };
                return {
                    legacy: true,
                    // properties
                    getElement: function()
                    {
                        return node_textarea;
                    },
                    getHTML: function()
                    {
                        return node_textarea.value;
                    },
                    setHTML: function( html )
                    {
                        node_textarea.value = newlineAfterBR( html );
                        return this;
                    },
                    getSelectedHTML: dummy_null,
                    sync: dummy_this,
                    readOnly: function( readonly )
                    {
                        // query read-only
                        if( readonly === undefined )
                            return node_textarea.hasAttribute ? node_textarea.hasAttribute('readonly') :
                                                                !!node_textarea.getAttribute('readonly'); // IE7
                        // set read-only
                        if( readonly )
                            node_textarea.setAttribute( 'readonly', 'readonly' );
                        else
                            node_textarea.removeAttribute( 'readonly' );
                        return this;
                    },
                    // selection and popup
                    collapseSelection: dummy_this,
                    expandSelection: dummy_this,
                    openPopup: dummy_null,
                    closePopup: dummy_this,
                    // exec commands
                    removeFormat: dummy_this,
                    bold: dummy_this,
                    italic: dummy_this,
                    underline: dummy_this,
                    strikethrough: dummy_this,
                    forecolor: dummy_this,
                    highlight: dummy_this,
                    fontName: dummy_this,
                    fontSize: dummy_this,
                    subscript: dummy_this,
                    superscript: dummy_this,
                    align: dummy_this,
                    format: dummy_this,
                    indent: dummy_this,
                    insertLink: dummy_this,
                    insertImage: dummy_this,
                    insertHTML: dummy_this,
                    insertList: dummy_this
                };
            }
        }

        // create content-editable
        var node_textarea = null,
            node_wysiwyg = null;
        if( is_textarea )
        {
            // Textarea
            node_textarea = option_element;
            node_textarea.style.display = 'none';

            // Contenteditable
            if( option_contenteditable )
                node_wysiwyg = option_contenteditable;
            else
            {
                node_wysiwyg = document.createElement( 'DIV' );
                node_wysiwyg.innerHTML = node_textarea.value || '';
                var parent = node_textarea.parentNode,
                    next = node_textarea.nextSibling;
                if( next )
                    parent.insertBefore( node_wysiwyg, next );
                else
                    parent.appendChild( node_wysiwyg );
            }
        }
        else
            node_wysiwyg = option_element;
        // If not read-only
        if( ! option_readonly )
            node_wysiwyg.setAttribute( 'contentEditable', 'true' ); // IE7 is case sensitive

        // IE8 uses 'document' instead of 'window'
        // http://tanalin.com/en/articles/ie-version-js/ - http://stackoverflow.com/questions/10964966/detect-ie-version-prior-to-v9-in-javascript
        var window_ie8 = (document.all && (! document.documentMode || document.documentMode <= 8)) ? document : window;

        // Sync Editor with Textarea
        var syncTextarea = null,
            callUpdates;
        if( is_textarea )
        {
            var previous_html = node_wysiwyg.innerHTML;
            syncTextarea = function()
            {
                var new_html = node_wysiwyg.innerHTML;
                if( new_html == previous_html )
                    return ;
                // HTML changed
                node_textarea.value = new_html;
                previous_html = new_html;
                // Event Handler
                fireEvent( node_textarea, 'change', false );
            };

            // handle reset event
            var form = node_textarea.form;
            if( form )
            {
                addEvent( form, 'reset', function() {
                    node_wysiwyg.innerHTML = '';
                    syncTextarea();
                    callUpdates( true );
                });
            }
        }

        // Show placeholder
        var showPlaceholder;
        if( option_onplaceholder )
        {
            var placeholder_visible = false;
            showPlaceholder = function()
            {
                // Test if wysiwyg has content
                var wysiwyg_empty = true;
                var node = node_wysiwyg;
                while( node )
                {
                    node = nextNode( node, node_wysiwyg );
                    // Test if node contains something visible
                    if( ! node )
                        ;
                    else if( node.nodeType == Node_ELEMENT_NODE )
                    {
                        if( node.nodeName == 'IMG' )
                        {
                            wysiwyg_empty = false;
                            break;
                        }
                    }
                    else if( node.nodeType == Node_TEXT_NODE )
                    {
                        var text = node.nodeValue;
                        if( text && text.search(/[^\s]/) != -1 )
                        {
                            wysiwyg_empty = false;
                            break;
                        }
                    }
                }
                if( placeholder_visible != wysiwyg_empty )
                {
                    option_onplaceholder( wysiwyg_empty );
                    placeholder_visible = wysiwyg_empty;
                }
            };
            showPlaceholder();
        }

        // Handle selection
        var popup_saved_selection = null, // preserve selection during popup
            handleSelection = null,
            debounced_handleSelection = null;
        if( option_onselection )
        {
            handleSelection = function( clientX, clientY, rightclick )
            {
                // Detect collapsed selection
                var collapsed = getSelectionCollapsed( node_wysiwyg );
                // List of all selected nodes
                var nodes = getSelectedNodes( node_wysiwyg );
                // Rectangle of the selection
                var rect = (clientX === null || clientY === null) ? null :
                            {
                                left: clientX,
                                top: clientY,
                                width: 0,
                                height: 0
                            };
                var selectionRect = getSelectionRect();
                if( selectionRect )
                    rect = selectionRect;
                if( rect )
                {
                    // So far 'rect' is relative to viewport
                    if( node_wysiwyg.getBoundingClientRect )
                    {
                        // Make it relative to the editor via 'getBoundingClientRect()'
                        var boundingrect = node_wysiwyg.getBoundingClientRect();
                        rect.left -= parseInt(boundingrect.left);
                        rect.top -= parseInt(boundingrect.top);
                    }
                    else
                    {
                        var node = node_wysiwyg,
                            offsetLeft = 0,
                            offsetTop = 0,
                            fixed = false;
                        do {
                            offsetLeft += node.offsetLeft ? parseInt(node.offsetLeft) : 0;
                            offsetTop += node.offsetTop ? parseInt(node.offsetTop) : 0;
                            if( node.style.position == 'fixed' )
                                fixed = true;
                        }
                        while( node = node.offsetParent );
                        rect.left -= offsetLeft - (fixed ? 0 : window.pageXOffset);
                        rect.top -= offsetTop - (fixed ? 0 : window.pageYOffset);
                    }
                    // Trim rectangle to the editor
                    if( rect.left < 0 )
                        rect.left = 0;
                    if( rect.top < 0 )
                        rect.top = 0;
                    if( rect.width > node_wysiwyg.offsetWidth )
                        rect.width = node_wysiwyg.offsetWidth;
                    if( rect.height > node_wysiwyg.offsetHeight )
                        rect.height = node_wysiwyg.offsetHeight;
                }
                else if( nodes.length )
                {
                    // What else could we do? Offset of first element...
                    for( var i=0; i < nodes.length; ++i )
                    {
                        var node = nodes[i];
                        if( node.nodeType != Node_ELEMENT_NODE )
                            continue;
                        rect = {
                                left: node.offsetLeft,
                                top: node.offsetTop,
                                width: node.offsetWidth,
                                height: node.offsetHeight
                            };
                        break;
                    }
                }
                // Callback
                option_onselection( collapsed, rect, nodes, rightclick );
            };
            debounced_handleSelection = debounce( handleSelection, 1 );
        }

        // Open popup
        var node_popup = null;
        var popupClickClose = function( e )
        {
            // http://www.quirksmode.org/js/events_properties.html
            if( !e )
                var e = window.event;
            var target = e.target || e.srcElement;
            if( target.nodeType == Node_TEXT_NODE ) // defeat Safari bug
                target = target.parentNode;
            // Click within popup?
            if( isOrContainsNode(node_popup,target) )
                return ;
            // close popup
            popupClose();
        };
        var popupOpen = function()
        {
            // Already open?
            if( node_popup )
                return node_popup;

            // Global click closes popup
            addEvent( window_ie8, 'mousedown', popupClickClose, true );

            // Create popup element
            node_popup = document.createElement( 'DIV' );
            var parent = node_wysiwyg.parentNode,
                next = node_wysiwyg.nextSibling;
            if( next )
                parent.insertBefore( node_popup, next );
            else
                parent.appendChild( node_popup );
            if( option_onopenpopup )
                option_onopenpopup();
            return node_popup;
        };
        var popupClose = function()
        {
            if( ! node_popup )
                return ;
            node_popup.parentNode.removeChild( node_popup );
            node_popup = null;
            removeEvent( window_ie8, 'mousedown', popupClickClose, true );
            if( option_onclosepopup )
                option_onclosepopup();
        };

        // Focus/Blur events
        addEvent( node_wysiwyg, 'focus', function()
        {
            // forward focus/blur to the textarea
            if( node_textarea )
                fireEvent( node_textarea, 'focus', false );
        });
        addEvent( node_wysiwyg, 'blur', function()
        {
            // sync textarea immediately
            if( syncTextarea )
                syncTextarea();
            // forward focus/blur to the textarea
            if( node_textarea )
                fireEvent( node_textarea, 'blur', false );
        });

        // Change events
        var debounced_changeHandler = null;
        if( showPlaceholder || syncTextarea )
        {
            // debounce 'syncTextarea' a second time, because 'innerHTML' is quite burdensome
            var debounced_syncTextarea = syncTextarea ? debounce( syncTextarea, 250, true ) : null; // high timeout is save, because of "onblur" fires immediately
            var changeHandler = function( e )
            {
                if( showPlaceholder )
                    showPlaceholder();
                if( debounced_syncTextarea )
                    debounced_syncTextarea();
            };
            debounced_changeHandler = debounce( changeHandler, 1 );

            // Catch change events
            // http://stackoverflow.com/questions/1391278/contenteditable-change-events/1411296#1411296
            // http://stackoverflow.com/questions/8694054/onchange-event-with-contenteditable/8694125#8694125
            // https://github.com/mindmup/bootstrap-wysiwyg/pull/50/files
            // http://codebits.glennjones.net/editing/events-contenteditable.htm
            addEvent( node_wysiwyg, 'input', debounced_changeHandler );
            addEvent( node_wysiwyg, 'DOMNodeInserted', debounced_changeHandler );
            addEvent( node_wysiwyg, 'DOMNodeRemoved', debounced_changeHandler );
            addEvent( node_wysiwyg, 'DOMSubtreeModified', debounced_changeHandler );
            addEvent( node_wysiwyg, 'DOMCharacterDataModified', debounced_changeHandler ); // polyfill input in IE 9-10
            addEvent( node_wysiwyg, 'propertychange', debounced_changeHandler );
            addEvent( node_wysiwyg, 'textInput', debounced_changeHandler );
            addEvent( node_wysiwyg, 'paste', debounced_changeHandler );
            addEvent( node_wysiwyg, 'cut', debounced_changeHandler );
            addEvent( node_wysiwyg, 'drop', debounced_changeHandler );
        }

        // Key events
        // http://sandbox.thewikies.com/html5-experiments/key-events.html
        var keyHandler = function( e, phase )
        {
            // http://www.quirksmode.org/js/events_properties.html
            if( !e )
                var e = window.event;
            // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent
            // http://stackoverflow.com/questions/1444477/keycode-and-charcode
            // http://stackoverflow.com/questions/4285627/javascript-keycode-vs-charcode-utter-confusion
            // http://unixpapa.com/js/key.html
            var key = e.which || e.keyCode,
                character = String.fromCharCode(key || e.charCode),
                shiftKey = e.shiftKey || false,
                altKey = e.altKey || false,
                ctrlKey = e.ctrlKey || false,
                metaKey = e.metaKey || false;
             if( phase == 1 )
            {
                // Callback
                if( option_onkeydown && option_onkeydown(key, character, shiftKey, altKey, ctrlKey, metaKey) === false )
                    return cancelEvent( e ); // dismiss key
            }
            else if( phase == 2 )
            {
                // Callback
                if( option_onkeypress && option_onkeypress(key, character, shiftKey, altKey, ctrlKey, metaKey) === false )
                    return cancelEvent( e ); // dismiss key
            }
            else if( phase == 3 )
            {
                // Callback
                if( option_onkeyup && option_onkeyup(key, character, shiftKey, altKey, ctrlKey, metaKey) === false )
                    return cancelEvent( e ); // dismiss key
            }

            // Keys can change the selection
            if( phase == 2 || phase == 3 )
            {
                popup_saved_selection = null;
                if( debounced_handleSelection )
                    debounced_handleSelection( null, null, false );
            }
            // Most keys can cause text-changes
            if( phase == 2 && debounced_changeHandler )
            {
                switch( key )
                {
                    case 33: // pageUp
                    case 34: // pageDown
                    case 35: // end
                    case 36: // home
                    case 37: // left
                    case 38: // up
                    case 39: // right
                    case 40: // down
                        // cursors do not
                        break;
                    default:
                        // call change handler
                        debounced_changeHandler();
                        break;
                }
            }
        };
        addEvent( node_wysiwyg, 'keydown', function( e )
        {
            return keyHandler( e, 1 );
        });
        addEvent( node_wysiwyg, 'keypress', function( e )
        {
            return keyHandler( e, 2 );
        });
        addEvent( node_wysiwyg, 'keyup', function( e )
        {
            return keyHandler( e, 3 );
        });

        // Mouse events
        var mouseHandler = function( e, rightclick )
        {
            // http://www.quirksmode.org/js/events_properties.html
            if( !e )
                var e = window.event;
            // mouse position
            var clientX = null,
                clientY = null;
            if( e.clientX && e.clientY )
            {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            else if( e.pageX && e.pageY )
            {
                clientX = e.pageX - window.pageXOffset;
                clientY = e.pageY - window.pageYOffset;
            }
            // mouse button
            if( e.which && e.which == 3 )
                rightclick = true;
            else if( e.button && e.button == 2 )
                rightclick = true;

            // remove event handler
            removeEvent( window_ie8, 'mouseup', mouseHandler );
            // Callback selection
            popup_saved_selection = null;
            if( ! option_hijackcontextmenu && rightclick )
                return ;
            if( debounced_handleSelection )
                debounced_handleSelection( clientX, clientY, rightclick );
        };
        addEvent( node_wysiwyg, 'mousedown', function( e )
        {
            // catch event if 'mouseup' outside 'node_wysiwyg'
            removeEvent( window_ie8, 'mouseup', mouseHandler );
            addEvent( window_ie8, 'mouseup', mouseHandler );
        });
        addEvent( node_wysiwyg, 'mouseup', function( e )
        {
            mouseHandler( e );
            // Trigger change
            if( debounced_changeHandler )
                debounced_changeHandler();
        });
        addEvent( node_wysiwyg, 'dblclick', function( e )
        {
            mouseHandler( e );
        });
        addEvent( node_wysiwyg, 'selectionchange',  function( e )
        {
            mouseHandler( e );
        });
        if( option_hijackcontextmenu )
        {
            addEvent( node_wysiwyg, 'contextmenu', function( e )
            {
                mouseHandler( e, true );
                return cancelEvent( e );
            });
        }


        // exec command
        // https://developer.mozilla.org/en-US/docs/Web/API/document.execCommand
        // http://www.quirksmode.org/dom/execCommand.html
        var execCommand = function( command, param, force_selection )
        {
            // give selection to contenteditable element
            restoreSelection( node_wysiwyg, popup_saved_selection );
            // tried to avoid forcing focus(), but ... - https://github.com/wysiwygjs/wysiwyg.js/issues/51
            node_wysiwyg.focus();
            if( ! selectionInside(node_wysiwyg, force_selection) ) // returns 'selection inside editor'
                return false;

            // for webkit, mozilla, opera
            if( window.getSelection )
            {
                // Buggy, call within 'try/catch'
                try {
                    if( document.queryCommandSupported && ! document.queryCommandSupported(command) )
                        return false;
                    return document.execCommand( command, false, param );
                }
                catch( e ) {
                }
            }
            // for IE
            else if( document.selection )
            {
                var sel = document.selection;
                if( sel.type != 'None' )
                {
                    var range = sel.createRange();
                    // Buggy, call within 'try/catch'
                    try {
                        if( ! range.queryCommandEnabled(command) )
                            return false;
                        return range.execCommand( command, false, param );
                    }
                    catch( e ) {
                    }
                }
            }
            return false;
        };

        // copy/paste images from clipboard - if FileReader-API is available
        if( window.FileReader )
        {
            addEvent( node_wysiwyg, 'paste', function( e )
            {
                var clipboardData = e.clipboardData;
                if( ! clipboardData )
                    return;
                var items = clipboardData.items;
                if( ! items || ! items.length )
                    return;
                var item = items[0];
                if( ! item.type.match(/^image\//) )
                    return;
                // Insert image from clipboard
                var filereader = new FileReader();
                filereader.onloadend = function( e )
                {
                    var image = e.target.result;
                    if( image )
                        execCommand( 'insertImage', image );
                };
                filereader.readAsDataURL( item.getAsFile() );
                return cancelEvent( e ); // dismiss paste
            });
        }

        // Workaround IE11 - https://github.com/wysiwygjs/wysiwyg.js/issues/14
        var trailingDiv = null;
        var IEtrailingDIV = function()
        {
            // Detect IE - http://stackoverflow.com/questions/17907445/how-to-detect-ie11
            if( document.all || !!window.MSInputMethodContext )
            {
                trailingDiv = document.createElement( 'DIV' );
                node_wysiwyg.appendChild( trailingDiv );
            }
        };
        // Command structure
        callUpdates = function( selection_destroyed )
        {
            // Remove IE11 workaround
            if( trailingDiv )
            {
                node_wysiwyg.removeChild( trailingDiv );
                trailingDiv = null;
            }
            // change-handler
            if( debounced_changeHandler )
                debounced_changeHandler();
            // handle saved selection
            if( selection_destroyed )
            {
                collapseSelectionEnd();
                popup_saved_selection = null; // selection destroyed
            }
            else if( popup_saved_selection )
                popup_saved_selection = saveSelection( node_wysiwyg );
        };
        return {
            // properties
            getElement: function()
            {
                return node_wysiwyg;
            },
            getHTML: function()
            {
                return node_wysiwyg.innerHTML;
            },
            setHTML: function( html )
            {
                node_wysiwyg.innerHTML = html || '<br>';
                callUpdates( true ); // selection destroyed
                return this;
            },
            getSelectedHTML: function()
            {
                restoreSelection( node_wysiwyg, popup_saved_selection );
                if( ! selectionInside(node_wysiwyg) )
                    return null;
                return getSelectionHtml( node_wysiwyg );
            },
            sync: function()
            {
                if( syncTextarea )
                    syncTextarea();
                return this;
            },
            readOnly: function( readonly )
            {
                // query read-only
                if( readonly === undefined )
                    return node_wysiwyg.hasAttribute ? !node_wysiwyg.hasAttribute('contentEditable') :
                                                       !node_wysiwyg.getAttribute('contentEditable'); // IE7
                // set read-only
                if( readonly )
                    node_wysiwyg.removeAttribute( 'contentEditable' );
                else
                    node_wysiwyg.setAttribute( 'contentEditable', 'true' ); // IE7 is case sensitive
                return this;
            },
            // selection and popup
            collapseSelection: function()
            {
                collapseSelectionEnd();
                popup_saved_selection = null; // selection destroyed
                return this;
            },
            expandSelection: function( preceding, following )
            {
                restoreSelection( node_wysiwyg, popup_saved_selection );
                if( ! selectionInside(node_wysiwyg) )
                    return this;
                expandSelectionCaret( node_wysiwyg, preceding, following );
                popup_saved_selection = saveSelection( node_wysiwyg ); // save new selection
                return this;
            },
            openPopup: function()
            {
                if( ! popup_saved_selection )
                    popup_saved_selection = saveSelection( node_wysiwyg ); // save current selection
                return popupOpen();
            },
            closePopup: function()
            {
                popupClose();
                return this;
            },
            removeFormat: function()
            {
                execCommand( 'removeFormat' );
                execCommand( 'unlink' );
                callUpdates();
                return this;
            },
            bold: function()
            {
                execCommand( 'bold' );
                callUpdates();
                return this;
            },
            italic: function()
            {
                execCommand( 'italic' );
                callUpdates();
                return this;
            },
            underline: function()
            {
                execCommand( 'underline' );
                callUpdates();
                return this;
            },
            strikethrough: function()
            {
                execCommand( 'strikeThrough' );
                callUpdates();
                return this;
            },
            forecolor: function( color )
            {
                execCommand( 'foreColor', color );
                callUpdates();
                return this;
            },
            highlight: function( color )
            {
                // http://stackoverflow.com/questions/2756931/highlight-the-text-of-the-dom-range-element
                if( ! execCommand('hiliteColor',color) ) // some browsers apply 'backColor' to the whole block
                    execCommand( 'backColor', color );
                callUpdates();
                return this;
            },
            fontName: function( name )
            {
                execCommand( 'fontName', name );
                callUpdates();
                return this;
            },
            fontSize: function( size )
            {
                execCommand( 'fontSize', size );
                callUpdates();
                return this;
            },
            subscript: function()
            {
                execCommand( 'subscript' );
                callUpdates();
                return this;
            },
            superscript: function()
            {
                execCommand( 'superscript' );
                callUpdates();
                return this;
            },
            align: function( align )
            {
                IEtrailingDIV();
                if( align == 'left' )
                    execCommand( 'justifyLeft' );
                else if( align == 'center' )
                    execCommand( 'justifyCenter' );
                else if( align == 'right' )
                    execCommand( 'justifyRight' );
                else if( align == 'justify' )
                    execCommand( 'justifyFull' );
                callUpdates();
                return this;
            },
            format: function( tagname )
            {
                IEtrailingDIV();
                execCommand( 'formatBlock', tagname );
                callUpdates();
                return this;
            },
            indent: function( outdent )
            {
                IEtrailingDIV();
                execCommand( outdent ? 'outdent' : 'indent' );
                callUpdates();
                return this;
            },
            insertLink: function( url )
            {
                execCommand( 'createLink', url );
                callUpdates( true ); // selection destroyed
                return this;
            },
            insertImage: function( url )
            {
                execCommand( 'insertImage', url, true );
                callUpdates( true ); // selection destroyed
                return this;
            },
            insertHTML: function( html )
            {
                if( ! execCommand('insertHTML', html, true) )
                {
                    // IE 11 still does not support 'insertHTML'
                    restoreSelection( node_wysiwyg, popup_saved_selection );
                    selectionInside( node_wysiwyg, true );
                    pasteHtmlAtCaret( node_wysiwyg, html );
                }
                callUpdates( true ); // selection destroyed
                return this;
            },
            insertList: function( ordered )
            {
                IEtrailingDIV();
                execCommand( ordered ? 'insertOrderedList' : 'insertUnorderedList' );
                callUpdates();
                return this;
            }
        };
    };

    return wysiwyg;
});

/*! selectize.js - v0.12.4 | https://github.com/selectize/selectize.js | Apache License (v2) */
!function(a,b){"function"==typeof define&&define.amd?define("sifter",b):"object"==typeof exports?module.exports=b():a.Sifter=b()}(this,function(){var a=function(a,b){this.items=a,this.settings=b||{diacritics:!0}};a.prototype.tokenize=function(a){if(a=e(String(a||"").toLowerCase()),!a||!a.length)return[];var b,c,d,g,i=[],j=a.split(/ +/);for(b=0,c=j.length;b<c;b++){if(d=f(j[b]),this.settings.diacritics)for(g in h)h.hasOwnProperty(g)&&(d=d.replace(new RegExp(g,"g"),h[g]));i.push({string:j[b],regex:new RegExp(d,"i")})}return i},a.prototype.iterator=function(a,b){var c;c=g(a)?Array.prototype.forEach||function(a){for(var b=0,c=this.length;b<c;b++)a(this[b],b,this)}:function(a){for(var b in this)this.hasOwnProperty(b)&&a(this[b],b,this)},c.apply(a,[b])},a.prototype.getScoreFunction=function(a,b){var c,e,f,g,h;c=this,a=c.prepareSearch(a,b),f=a.tokens,e=a.options.fields,g=f.length,h=a.options.nesting;var i=function(a,b){var c,d;return a?(a=String(a||""),d=a.search(b.regex),d===-1?0:(c=b.string.length/a.length,0===d&&(c+=.5),c)):0},j=function(){var a=e.length;return a?1===a?function(a,b){return i(d(b,e[0],h),a)}:function(b,c){for(var f=0,g=0;f<a;f++)g+=i(d(c,e[f],h),b);return g/a}:function(){return 0}}();return g?1===g?function(a){return j(f[0],a)}:"and"===a.options.conjunction?function(a){for(var b,c=0,d=0;c<g;c++){if(b=j(f[c],a),b<=0)return 0;d+=b}return d/g}:function(a){for(var b=0,c=0;b<g;b++)c+=j(f[b],a);return c/g}:function(){return 0}},a.prototype.getSortFunction=function(a,c){var e,f,g,h,i,j,k,l,m,n,o;if(g=this,a=g.prepareSearch(a,c),o=!a.query&&c.sort_empty||c.sort,m=function(a,b){return"$score"===a?b.score:d(g.items[b.id],a,c.nesting)},i=[],o)for(e=0,f=o.length;e<f;e++)(a.query||"$score"!==o[e].field)&&i.push(o[e]);if(a.query){for(n=!0,e=0,f=i.length;e<f;e++)if("$score"===i[e].field){n=!1;break}n&&i.unshift({field:"$score",direction:"desc"})}else for(e=0,f=i.length;e<f;e++)if("$score"===i[e].field){i.splice(e,1);break}for(l=[],e=0,f=i.length;e<f;e++)l.push("desc"===i[e].direction?-1:1);return j=i.length,j?1===j?(h=i[0].field,k=l[0],function(a,c){return k*b(m(h,a),m(h,c))}):function(a,c){var d,e,f;for(d=0;d<j;d++)if(f=i[d].field,e=l[d]*b(m(f,a),m(f,c)))return e;return 0}:null},a.prototype.prepareSearch=function(a,b){if("object"==typeof a)return a;b=c({},b);var d=b.fields,e=b.sort,f=b.sort_empty;return d&&!g(d)&&(b.fields=[d]),e&&!g(e)&&(b.sort=[e]),f&&!g(f)&&(b.sort_empty=[f]),{options:b,query:String(a||"").toLowerCase(),tokens:this.tokenize(a),total:0,items:[]}},a.prototype.search=function(a,b){var c,d,e,f,g=this;return d=this.prepareSearch(a,b),b=d.options,a=d.query,f=b.score||g.getScoreFunction(d),a.length?g.iterator(g.items,function(a,e){c=f(a),(b.filter===!1||c>0)&&d.items.push({score:c,id:e})}):g.iterator(g.items,function(a,b){d.items.push({score:1,id:b})}),e=g.getSortFunction(d,b),e&&d.items.sort(e),d.total=d.items.length,"number"==typeof b.limit&&(d.items=d.items.slice(0,b.limit)),d};var b=function(a,b){return"number"==typeof a&&"number"==typeof b?a>b?1:a<b?-1:0:(a=i(String(a||"")),b=i(String(b||"")),a>b?1:b>a?-1:0)},c=function(a,b){var c,d,e,f;for(c=1,d=arguments.length;c<d;c++)if(f=arguments[c])for(e in f)f.hasOwnProperty(e)&&(a[e]=f[e]);return a},d=function(a,b,c){if(a&&b){if(!c)return a[b];for(var d=b.split(".");d.length&&(a=a[d.shift()]););return a}},e=function(a){return(a+"").replace(/^\s+|\s+$|/g,"")},f=function(a){return(a+"").replace(/([.?*+^$[\]\\(){}|-])/g,"\\$1")},g=Array.isArray||"undefined"!=typeof $&&$.isArray||function(a){return"[object Array]"===Object.prototype.toString.call(a)},h={a:"[aḀḁĂăÂâǍǎȺⱥȦȧẠạÄäÀàÁáĀāÃãÅåąĄÃąĄ]",b:"[b␢βΒB฿𐌁ᛒ]",c:"[cĆćĈĉČčĊċC̄c̄ÇçḈḉȻȼƇƈɕᴄＣｃ]",d:"[dĎďḊḋḐḑḌḍḒḓḎḏĐđD̦d̦ƉɖƊɗƋƌᵭᶁᶑȡᴅＤｄð]",e:"[eÉéÈèÊêḘḙĚěĔĕẼẽḚḛẺẻĖėËëĒēȨȩĘęᶒɆɇȄȅẾếỀềỄễỂểḜḝḖḗḔḕȆȇẸẹỆệⱸᴇＥｅɘǝƏƐε]",f:"[fƑƒḞḟ]",g:"[gɢ₲ǤǥĜĝĞğĢģƓɠĠġ]",h:"[hĤĥĦħḨḩẖẖḤḥḢḣɦʰǶƕ]",i:"[iÍíÌìĬĭÎîǏǐÏïḮḯĨĩĮįĪīỈỉȈȉȊȋỊịḬḭƗɨɨ̆ᵻᶖİiIıɪＩｉ]",j:"[jȷĴĵɈɉʝɟʲ]",k:"[kƘƙꝀꝁḰḱǨǩḲḳḴḵκϰ₭]",l:"[lŁłĽľĻļĹĺḶḷḸḹḼḽḺḻĿŀȽƚⱠⱡⱢɫɬᶅɭȴʟＬｌ]",n:"[nŃńǸǹŇňÑñṄṅŅņṆṇṊṋṈṉN̈n̈ƝɲȠƞᵰᶇɳȵɴＮｎŊŋ]",o:"[oØøÖöÓóÒòÔôǑǒŐőŎŏȮȯỌọƟɵƠơỎỏŌōÕõǪǫȌȍՕօ]",p:"[pṔṕṖṗⱣᵽƤƥᵱ]",q:"[qꝖꝗʠɊɋꝘꝙq̃]",r:"[rŔŕɌɍŘřŖŗṘṙȐȑȒȓṚṛⱤɽ]",s:"[sŚśṠṡṢṣꞨꞩŜŝŠšŞşȘșS̈s̈]",t:"[tŤťṪṫŢţṬṭƮʈȚțṰṱṮṯƬƭ]",u:"[uŬŭɄʉỤụÜüÚúÙùÛûǓǔŰűŬŭƯưỦủŪūŨũŲųȔȕ∪]",v:"[vṼṽṾṿƲʋꝞꝟⱱʋ]",w:"[wẂẃẀẁŴŵẄẅẆẇẈẉ]",x:"[xẌẍẊẋχ]",y:"[yÝýỲỳŶŷŸÿỸỹẎẏỴỵɎɏƳƴ]",z:"[zŹźẐẑŽžŻżẒẓẔẕƵƶ]"},i=function(){var a,b,c,d,e="",f={};for(c in h)if(h.hasOwnProperty(c))for(d=h[c].substring(2,h[c].length-1),e+=d,a=0,b=d.length;a<b;a++)f[d.charAt(a)]=c;var g=new RegExp("["+e+"]","g");return function(a){return a.replace(g,function(a){return f[a]}).toLowerCase()}}();return a}),function(a,b){"function"==typeof define&&define.amd?define("microplugin",b):"object"==typeof exports?module.exports=b():a.MicroPlugin=b()}(this,function(){var a={};a.mixin=function(a){a.plugins={},a.prototype.initializePlugins=function(a){var c,d,e,f=this,g=[];if(f.plugins={names:[],settings:{},requested:{},loaded:{}},b.isArray(a))for(c=0,d=a.length;c<d;c++)"string"==typeof a[c]?g.push(a[c]):(f.plugins.settings[a[c].name]=a[c].options,g.push(a[c].name));else if(a)for(e in a)a.hasOwnProperty(e)&&(f.plugins.settings[e]=a[e],g.push(e));for(;g.length;)f.require(g.shift())},a.prototype.loadPlugin=function(b){var c=this,d=c.plugins,e=a.plugins[b];if(!a.plugins.hasOwnProperty(b))throw new Error('Unable to find "'+b+'" plugin');d.requested[b]=!0,d.loaded[b]=e.fn.apply(c,[c.plugins.settings[b]||{}]),d.names.push(b)},a.prototype.require=function(a){var b=this,c=b.plugins;if(!b.plugins.loaded.hasOwnProperty(a)){if(c.requested[a])throw new Error('Plugin has circular dependency ("'+a+'")');b.loadPlugin(a)}return c.loaded[a]},a.define=function(b,c){a.plugins[b]={name:b,fn:c}}};var b={isArray:Array.isArray||function(a){return"[object Array]"===Object.prototype.toString.call(a)}};return a}),function(a,b){"function"==typeof define&&define.amd?define("selectize",["jquery","sifter","microplugin"],b):"object"==typeof exports?module.exports=b(require("jquery"),require("sifter"),require("microplugin")):a.Selectize=b(a.jQuery,a.Sifter,a.MicroPlugin)}(this,function(a,b,c){"use strict";var d=function(a,b){if("string"!=typeof b||b.length){var c="string"==typeof b?new RegExp(b,"i"):b,d=function(a){var b=0;if(3===a.nodeType){var e=a.data.search(c);if(e>=0&&a.data.length>0){var f=a.data.match(c),g=document.createElement("span");g.className="highlight";var h=a.splitText(e),i=(h.splitText(f[0].length),h.cloneNode(!0));g.appendChild(i),h.parentNode.replaceChild(g,h),b=1}}else if(1===a.nodeType&&a.childNodes&&!/(script|style)/i.test(a.tagName))for(var j=0;j<a.childNodes.length;++j)j+=d(a.childNodes[j]);return b};return a.each(function(){d(this)})}};a.fn.removeHighlight=function(){return this.find("span.highlight").each(function(){this.parentNode.firstChild.nodeName;var a=this.parentNode;a.replaceChild(this.firstChild,this),a.normalize()}).end()};var e=function(){};e.prototype={on:function(a,b){this._events=this._events||{},this._events[a]=this._events[a]||[],this._events[a].push(b)},off:function(a,b){var c=arguments.length;return 0===c?delete this._events:1===c?delete this._events[a]:(this._events=this._events||{},void(a in this._events!=!1&&this._events[a].splice(this._events[a].indexOf(b),1)))},trigger:function(a){if(this._events=this._events||{},a in this._events!=!1)for(var b=0;b<this._events[a].length;b++)this._events[a][b].apply(this,Array.prototype.slice.call(arguments,1))}},e.mixin=function(a){for(var b=["on","off","trigger"],c=0;c<b.length;c++)a.prototype[b[c]]=e.prototype[b[c]]};var f=/Mac/.test(navigator.userAgent),g=65,h=13,i=27,j=37,k=38,l=80,m=39,n=40,o=78,p=8,q=46,r=16,s=f?91:17,t=f?18:17,u=9,v=1,w=2,x=!/android/i.test(window.navigator.userAgent)&&!!document.createElement("input").validity,y=function(a){return"undefined"!=typeof a},z=function(a){return"undefined"==typeof a||null===a?null:"boolean"==typeof a?a?"1":"0":a+""},A=function(a){return(a+"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")},B={};B.before=function(a,b,c){var d=a[b];a[b]=function(){return c.apply(a,arguments),d.apply(a,arguments)}},B.after=function(a,b,c){var d=a[b];a[b]=function(){var b=d.apply(a,arguments);return c.apply(a,arguments),b}};var C=function(a){var b=!1;return function(){b||(b=!0,a.apply(this,arguments))}},D=function(a,b){var c;return function(){var d=this,e=arguments;window.clearTimeout(c),c=window.setTimeout(function(){a.apply(d,e)},b)}},E=function(a,b,c){var d,e=a.trigger,f={};a.trigger=function(){var c=arguments[0];return b.indexOf(c)===-1?e.apply(a,arguments):void(f[c]=arguments)},c.apply(a,[]),a.trigger=e;for(d in f)f.hasOwnProperty(d)&&e.apply(a,f[d])},F=function(a,b,c,d){a.on(b,c,function(b){for(var c=b.target;c&&c.parentNode!==a[0];)c=c.parentNode;return b.currentTarget=c,d.apply(this,[b])})},G=function(a){var b={};if("selectionStart"in a)b.start=a.selectionStart,b.length=a.selectionEnd-b.start;else if(document.selection){a.focus();var c=document.selection.createRange(),d=document.selection.createRange().text.length;c.moveStart("character",-a.value.length),b.start=c.text.length-d,b.length=d}return b},H=function(a,b,c){var d,e,f={};if(c)for(d=0,e=c.length;d<e;d++)f[c[d]]=a.css(c[d]);else f=a.css();b.css(f)},I=function(b,c){if(!b)return 0;var d=a("<test>").css({position:"absolute",top:-99999,left:-99999,width:"auto",padding:0,whiteSpace:"pre"}).text(b).appendTo("body");H(c,d,["letterSpacing","fontSize","fontFamily","fontWeight","textTransform"]);var e=d.width();return d.remove(),e},J=function(a){var b=null,c=function(c,d){var e,f,g,h,i,j,k,l;c=c||window.event||{},d=d||{},c.metaKey||c.altKey||(d.force||a.data("grow")!==!1)&&(e=a.val(),c.type&&"keydown"===c.type.toLowerCase()&&(f=c.keyCode,g=f>=97&&f<=122||f>=65&&f<=90||f>=48&&f<=57||32===f,f===q||f===p?(l=G(a[0]),l.length?e=e.substring(0,l.start)+e.substring(l.start+l.length):f===p&&l.start?e=e.substring(0,l.start-1)+e.substring(l.start+1):f===q&&"undefined"!=typeof l.start&&(e=e.substring(0,l.start)+e.substring(l.start+1))):g&&(j=c.shiftKey,k=String.fromCharCode(c.keyCode),k=j?k.toUpperCase():k.toLowerCase(),e+=k)),h=a.attr("placeholder"),!e&&h&&(e=h),i=I(e,a)+4,i!==b&&(b=i,a.width(i),a.triggerHandler("resize")))};a.on("keydown keyup update blur",c),c()},K=function(a){var b=document.createElement("div");return b.appendChild(a.cloneNode(!0)),b.innerHTML},L=function(a,b){b||(b={});var c="Selectize";console.error(c+": "+a),b.explanation&&(console.group&&console.group(),console.error(b.explanation),console.group&&console.groupEnd())},M=function(c,d){var e,f,g,h,i=this;h=c[0],h.selectize=i;var j=window.getComputedStyle&&window.getComputedStyle(h,null);if(g=j?j.getPropertyValue("direction"):h.currentStyle&&h.currentStyle.direction,g=g||c.parents("[dir]:first").attr("dir")||"",a.extend(i,{order:0,settings:d,$input:c,tabIndex:c.attr("tabindex")||"",tagType:"select"===h.tagName.toLowerCase()?v:w,rtl:/rtl/i.test(g),eventNS:".selectize"+ ++M.count,highlightedValue:null,isOpen:!1,isDisabled:!1,isRequired:c.is("[required]"),isInvalid:!1,isLocked:!1,isFocused:!1,isInputHidden:!1,isSetup:!1,isShiftDown:!1,isCmdDown:!1,isCtrlDown:!1,ignoreFocus:!1,ignoreBlur:!1,ignoreHover:!1,hasOptions:!1,currentResults:null,lastValue:"",caretPos:0,loading:0,loadedSearches:{},$activeOption:null,$activeItems:[],optgroups:{},options:{},userOptions:{},items:[],renderCache:{},onSearchChange:null===d.loadThrottle?i.onSearchChange:D(i.onSearchChange,d.loadThrottle)}),i.sifter=new b(this.options,{diacritics:d.diacritics}),i.settings.options){for(e=0,f=i.settings.options.length;e<f;e++)i.registerOption(i.settings.options[e]);delete i.settings.options}if(i.settings.optgroups){for(e=0,f=i.settings.optgroups.length;e<f;e++)i.registerOptionGroup(i.settings.optgroups[e]);delete i.settings.optgroups}i.settings.mode=i.settings.mode||(1===i.settings.maxItems?"single":"multi"),"boolean"!=typeof i.settings.hideSelected&&(i.settings.hideSelected="multi"===i.settings.mode),i.initializePlugins(i.settings.plugins),i.setupCallbacks(),i.setupTemplates(),i.setup()};return e.mixin(M),"undefined"!=typeof c?c.mixin(M):L("Dependency MicroPlugin is missing",{explanation:'Make sure you either: (1) are using the "standalone" version of Selectize, or (2) require MicroPlugin before you load Selectize.'}),a.extend(M.prototype,{setup:function(){var b,c,d,e,g,h,i,j,k,l,m=this,n=m.settings,o=m.eventNS,p=a(window),q=a(document),u=m.$input;if(i=m.settings.mode,j=u.attr("class")||"",b=a("<div>").addClass(n.wrapperClass).addClass(j).addClass(i),c=a("<div>").addClass(n.inputClass).addClass("items").appendTo(b),d=a('<input type="text" autocomplete="off" />').appendTo(c).attr("tabindex",u.is(":disabled")?"-1":m.tabIndex),h=a(n.dropdownParent||b),e=a("<div>").addClass(n.dropdownClass).addClass(i).hide().appendTo(h),g=a("<div>").addClass(n.dropdownContentClass).appendTo(e),(l=u.attr("id"))&&(d.attr("id",l+"-selectized"),a("label[for='"+l+"']").attr("for",l+"-selectized")),m.settings.copyClassesToDropdown&&e.addClass(j),b.css({width:u[0].style.width}),m.plugins.names.length&&(k="plugin-"+m.plugins.names.join(" plugin-"),b.addClass(k),e.addClass(k)),(null===n.maxItems||n.maxItems>1)&&m.tagType===v&&u.attr("multiple","multiple"),m.settings.placeholder&&d.attr("placeholder",n.placeholder),!m.settings.splitOn&&m.settings.delimiter){var w=m.settings.delimiter.replace(/[-\/\\^$*+?.()|[\]{}]/g,"\\$&");m.settings.splitOn=new RegExp("\\s*"+w+"+\\s*")}u.attr("autocorrect")&&d.attr("autocorrect",u.attr("autocorrect")),u.attr("autocapitalize")&&d.attr("autocapitalize",u.attr("autocapitalize")),m.$wrapper=b,m.$control=c,m.$control_input=d,m.$dropdown=e,m.$dropdown_content=g,e.on("mouseenter","[data-selectable]",function(){return m.onOptionHover.apply(m,arguments)}),e.on("mousedown click","[data-selectable]",function(){return m.onOptionSelect.apply(m,arguments)}),F(c,"mousedown","*:not(input)",function(){return m.onItemSelect.apply(m,arguments)}),J(d),c.on({mousedown:function(){return m.onMouseDown.apply(m,arguments)},click:function(){return m.onClick.apply(m,arguments)}}),d.on({mousedown:function(a){a.stopPropagation()},keydown:function(){return m.onKeyDown.apply(m,arguments)},keyup:function(){return m.onKeyUp.apply(m,arguments)},keypress:function(){return m.onKeyPress.apply(m,arguments)},resize:function(){m.positionDropdown.apply(m,[])},blur:function(){return m.onBlur.apply(m,arguments)},focus:function(){return m.ignoreBlur=!1,m.onFocus.apply(m,arguments)},paste:function(){return m.onPaste.apply(m,arguments)}}),q.on("keydown"+o,function(a){m.isCmdDown=a[f?"metaKey":"ctrlKey"],m.isCtrlDown=a[f?"altKey":"ctrlKey"],m.isShiftDown=a.shiftKey}),q.on("keyup"+o,function(a){a.keyCode===t&&(m.isCtrlDown=!1),a.keyCode===r&&(m.isShiftDown=!1),a.keyCode===s&&(m.isCmdDown=!1)}),q.on("mousedown"+o,function(a){if(m.isFocused){if(a.target===m.$dropdown[0]||a.target.parentNode===m.$dropdown[0])return!1;m.$control.has(a.target).length||a.target===m.$control[0]||m.blur(a.target)}}),p.on(["scroll"+o,"resize"+o].join(" "),function(){m.isOpen&&m.positionDropdown.apply(m,arguments)}),p.on("mousemove"+o,function(){m.ignoreHover=!1}),this.revertSettings={$children:u.children().detach(),tabindex:u.attr("tabindex")},u.attr("tabindex",-1).hide().after(m.$wrapper),a.isArray(n.items)&&(m.setValue(n.items),delete n.items),x&&u.on("invalid"+o,function(a){a.preventDefault(),m.isInvalid=!0,m.refreshState()}),m.updateOriginalInput(),m.refreshItems(),m.refreshState(),m.updatePlaceholder(),m.isSetup=!0,u.is(":disabled")&&m.disable(),m.on("change",this.onChange),u.data("selectize",m),u.addClass("selectized"),m.trigger("initialize"),n.preload===!0&&m.onSearchChange("")},setupTemplates:function(){var b=this,c=b.settings.labelField,d=b.settings.optgroupLabelField,e={optgroup:function(a){return'<div class="optgroup">'+a.html+"</div>"},optgroup_header:function(a,b){return'<div class="optgroup-header">'+b(a[d])+"</div>"},option:function(a,b){return'<div class="option">'+b(a[c])+"</div>"},item:function(a,b){return'<div class="item">'+b(a[c])+"</div>"},option_create:function(a,b){return'<div class="create">Add <strong>'+b(a.input)+"</strong>&hellip;</div>"}};b.settings.render=a.extend({},e,b.settings.render)},setupCallbacks:function(){var a,b,c={initialize:"onInitialize",change:"onChange",item_add:"onItemAdd",item_remove:"onItemRemove",clear:"onClear",option_add:"onOptionAdd",option_remove:"onOptionRemove",option_clear:"onOptionClear",optgroup_add:"onOptionGroupAdd",optgroup_remove:"onOptionGroupRemove",optgroup_clear:"onOptionGroupClear",dropdown_open:"onDropdownOpen",dropdown_close:"onDropdownClose",type:"onType",load:"onLoad",focus:"onFocus",blur:"onBlur"};for(a in c)c.hasOwnProperty(a)&&(b=this.settings[c[a]],b&&this.on(a,b))},onClick:function(a){var b=this;b.isFocused||(b.focus(),a.preventDefault())},onMouseDown:function(b){var c=this,d=b.isDefaultPrevented();a(b.target);if(c.isFocused){if(b.target!==c.$control_input[0])return"single"===c.settings.mode?c.isOpen?c.close():c.open():d||c.setActiveItem(null),!1}else d||window.setTimeout(function(){c.focus()},0)},onChange:function(){this.$input.trigger("change")},onPaste:function(b){var c=this;return c.isFull()||c.isInputHidden||c.isLocked?void b.preventDefault():void(c.settings.splitOn&&setTimeout(function(){var b=c.$control_input.val();if(b.match(c.settings.splitOn))for(var d=a.trim(b).split(c.settings.splitOn),e=0,f=d.length;e<f;e++)c.createItem(d[e])},0))},onKeyPress:function(a){if(this.isLocked)return a&&a.preventDefault();var b=String.fromCharCode(a.keyCode||a.which);return this.settings.create&&"multi"===this.settings.mode&&b===this.settings.delimiter?(this.createItem(),a.preventDefault(),!1):void 0},onKeyDown:function(a){var b=(a.target===this.$control_input[0],this);if(b.isLocked)return void(a.keyCode!==u&&a.preventDefault());switch(a.keyCode){case g:if(b.isCmdDown)return void b.selectAll();break;case i:return void(b.isOpen&&(a.preventDefault(),a.stopPropagation(),b.close()));case o:if(!a.ctrlKey||a.altKey)break;case n:if(!b.isOpen&&b.hasOptions)b.open();else if(b.$activeOption){b.ignoreHover=!0;var c=b.getAdjacentOption(b.$activeOption,1);c.length&&b.setActiveOption(c,!0,!0)}return void a.preventDefault();case l:if(!a.ctrlKey||a.altKey)break;case k:if(b.$activeOption){b.ignoreHover=!0;var d=b.getAdjacentOption(b.$activeOption,-1);d.length&&b.setActiveOption(d,!0,!0)}return void a.preventDefault();case h:return void(b.isOpen&&b.$activeOption&&(b.onOptionSelect({currentTarget:b.$activeOption}),a.preventDefault()));case j:return void b.advanceSelection(-1,a);case m:return void b.advanceSelection(1,a);case u:return b.settings.selectOnTab&&b.isOpen&&b.$activeOption&&(b.onOptionSelect({currentTarget:b.$activeOption}),b.isFull()||a.preventDefault()),void(b.settings.create&&b.createItem()&&a.preventDefault());case p:case q:return void b.deleteSelection(a)}return!b.isFull()&&!b.isInputHidden||(f?a.metaKey:a.ctrlKey)?void 0:void a.preventDefault()},onKeyUp:function(a){var b=this;if(b.isLocked)return a&&a.preventDefault();var c=b.$control_input.val()||"";b.lastValue!==c&&(b.lastValue=c,b.onSearchChange(c),b.refreshOptions(),b.trigger("type",c))},onSearchChange:function(a){var b=this,c=b.settings.load;c&&(b.loadedSearches.hasOwnProperty(a)||(b.loadedSearches[a]=!0,b.load(function(d){c.apply(b,[a,d])})))},onFocus:function(a){var b=this,c=b.isFocused;return b.isDisabled?(b.blur(),a&&a.preventDefault(),!1):void(b.ignoreFocus||(b.isFocused=!0,"focus"===b.settings.preload&&b.onSearchChange(""),c||b.trigger("focus"),b.$activeItems.length||(b.showInput(),b.setActiveItem(null),b.refreshOptions(!!b.settings.openOnFocus)),b.refreshState()))},onBlur:function(a,b){var c=this;if(c.isFocused&&(c.isFocused=!1,!c.ignoreFocus)){if(!c.ignoreBlur&&document.activeElement===c.$dropdown_content[0])return c.ignoreBlur=!0,void c.onFocus(a);var d=function(){c.close(),c.setTextboxValue(""),c.setActiveItem(null),c.setActiveOption(null),c.setCaret(c.items.length),c.refreshState(),b&&b.focus&&b.focus(),c.ignoreFocus=!1,c.trigger("blur")};c.ignoreFocus=!0,c.settings.create&&c.settings.createOnBlur?c.createItem(null,!1,d):d()}},onOptionHover:function(a){this.ignoreHover||this.setActiveOption(a.currentTarget,!1)},onOptionSelect:function(b){var c,d,e=this;b.preventDefault&&(b.preventDefault(),b.stopPropagation()),d=a(b.currentTarget),d.hasClass("create")?e.createItem(null,function(){e.settings.closeAfterSelect&&e.close()}):(c=d.attr("data-value"),"undefined"!=typeof c&&(e.lastQuery=null,e.setTextboxValue(""),e.addItem(c),e.settings.closeAfterSelect?e.close():!e.settings.hideSelected&&b.type&&/mouse/.test(b.type)&&e.setActiveOption(e.getOption(c))))},onItemSelect:function(a){var b=this;b.isLocked||"multi"===b.settings.mode&&(a.preventDefault(),b.setActiveItem(a.currentTarget,a))},load:function(a){var b=this,c=b.$wrapper.addClass(b.settings.loadingClass);b.loading++,a.apply(b,[function(a){b.loading=Math.max(b.loading-1,0),a&&a.length&&(b.addOption(a),b.refreshOptions(b.isFocused&&!b.isInputHidden)),b.loading||c.removeClass(b.settings.loadingClass),b.trigger("load",a)}])},setTextboxValue:function(a){var b=this.$control_input,c=b.val()!==a;c&&(b.val(a).triggerHandler("update"),this.lastValue=a)},getValue:function(){return this.tagType===v&&this.$input.attr("multiple")?this.items:this.items.join(this.settings.delimiter)},setValue:function(a,b){var c=b?[]:["change"];E(this,c,function(){this.clear(b),this.addItems(a,b)})},setActiveItem:function(b,c){var d,e,f,g,h,i,j,k,l=this;if("single"!==l.settings.mode){if(b=a(b),!b.length)return a(l.$activeItems).removeClass("active"),l.$activeItems=[],void(l.isFocused&&l.showInput());if(d=c&&c.type.toLowerCase(),"mousedown"===d&&l.isShiftDown&&l.$activeItems.length){for(k=l.$control.children(".active:last"),g=Array.prototype.indexOf.apply(l.$control[0].childNodes,[k[0]]),h=Array.prototype.indexOf.apply(l.$control[0].childNodes,[b[0]]),g>h&&(j=g,g=h,h=j),e=g;e<=h;e++)i=l.$control[0].childNodes[e],l.$activeItems.indexOf(i)===-1&&(a(i).addClass("active"),l.$activeItems.push(i));c.preventDefault()}else"mousedown"===d&&l.isCtrlDown||"keydown"===d&&this.isShiftDown?b.hasClass("active")?(f=l.$activeItems.indexOf(b[0]),l.$activeItems.splice(f,1),b.removeClass("active")):l.$activeItems.push(b.addClass("active")[0]):(a(l.$activeItems).removeClass("active"),l.$activeItems=[b.addClass("active")[0]]);l.hideInput(),this.isFocused||l.focus()}},setActiveOption:function(b,c,d){var e,f,g,h,i,j=this;j.$activeOption&&j.$activeOption.removeClass("active"),j.$activeOption=null,b=a(b),b.length&&(j.$activeOption=b.addClass("active"),!c&&y(c)||(e=j.$dropdown_content.height(),f=j.$activeOption.outerHeight(!0),c=j.$dropdown_content.scrollTop()||0,g=j.$activeOption.offset().top-j.$dropdown_content.offset().top+c,h=g,i=g-e+f,g+f>e+c?j.$dropdown_content.stop().animate({scrollTop:i},d?j.settings.scrollDuration:0):g<c&&j.$dropdown_content.stop().animate({scrollTop:h},d?j.settings.scrollDuration:0)))},selectAll:function(){var a=this;"single"!==a.settings.mode&&(a.$activeItems=Array.prototype.slice.apply(a.$control.children(":not(input)").addClass("active")),a.$activeItems.length&&(a.hideInput(),a.close()),a.focus())},hideInput:function(){var a=this;a.setTextboxValue(""),a.$control_input.css({opacity:0,position:"absolute",left:a.rtl?1e4:-1e4}),a.isInputHidden=!0},showInput:function(){this.$control_input.css({opacity:1,position:"relative",left:0}),this.isInputHidden=!1},focus:function(){var a=this;a.isDisabled||(a.ignoreFocus=!0,a.$control_input[0].focus(),window.setTimeout(function(){a.ignoreFocus=!1,a.onFocus()},0))},blur:function(a){this.$control_input[0].blur(),this.onBlur(null,a)},getScoreFunction:function(a){return this.sifter.getScoreFunction(a,this.getSearchOptions())},getSearchOptions:function(){var a=this.settings,b=a.sortField;return"string"==typeof b&&(b=[{field:b}]),{fields:a.searchField,conjunction:a.searchConjunction,sort:b}},search:function(b){var c,d,e,f=this,g=f.settings,h=this.getSearchOptions();if(g.score&&(e=f.settings.score.apply(this,[b]),"function"!=typeof e))throw new Error('Selectize "score" setting must be a function that returns a function');if(b!==f.lastQuery?(f.lastQuery=b,d=f.sifter.search(b,a.extend(h,{score:e})),f.currentResults=d):d=a.extend(!0,{},f.currentResults),g.hideSelected)for(c=d.items.length-1;c>=0;c--)f.items.indexOf(z(d.items[c].id))!==-1&&d.items.splice(c,1);return d},refreshOptions:function(b){var c,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s;"undefined"==typeof b&&(b=!0);var t=this,u=a.trim(t.$control_input.val()),v=t.search(u),w=t.$dropdown_content,x=t.$activeOption&&z(t.$activeOption.attr("data-value"));for(g=v.items.length,"number"==typeof t.settings.maxOptions&&(g=Math.min(g,t.settings.maxOptions)),h={},i=[],c=0;c<g;c++)for(j=t.options[v.items[c].id],k=t.render("option",j),l=j[t.settings.optgroupField]||"",m=a.isArray(l)?l:[l],e=0,f=m&&m.length;e<f;e++)l=m[e],t.optgroups.hasOwnProperty(l)||(l=""),h.hasOwnProperty(l)||(h[l]=document.createDocumentFragment(),i.push(l)),h[l].appendChild(k);for(this.settings.lockOptgroupOrder&&i.sort(function(a,b){var c=t.optgroups[a].$order||0,d=t.optgroups[b].$order||0;return c-d}),n=document.createDocumentFragment(),c=0,g=i.length;c<g;c++)l=i[c],t.optgroups.hasOwnProperty(l)&&h[l].childNodes.length?(o=document.createDocumentFragment(),o.appendChild(t.render("optgroup_header",t.optgroups[l])),o.appendChild(h[l]),n.appendChild(t.render("optgroup",a.extend({},t.optgroups[l],{html:K(o),dom:o})))):n.appendChild(h[l]);if(w.html(n),t.settings.highlight&&v.query.length&&v.tokens.length)for(w.removeHighlight(),c=0,g=v.tokens.length;c<g;c++)d(w,v.tokens[c].regex);if(!t.settings.hideSelected)for(c=0,g=t.items.length;c<g;c++)t.getOption(t.items[c]).addClass("selected");p=t.canCreate(u),p&&(w.prepend(t.render("option_create",{input:u})),s=a(w[0].childNodes[0])),t.hasOptions=v.items.length>0||p,t.hasOptions?(v.items.length>0?(r=x&&t.getOption(x),r&&r.length?q=r:"single"===t.settings.mode&&t.items.length&&(q=t.getOption(t.items[0])),q&&q.length||(q=s&&!t.settings.addPrecedence?t.getAdjacentOption(s,1):w.find("[data-selectable]:first"))):q=s,t.setActiveOption(q),b&&!t.isOpen&&t.open()):(t.setActiveOption(null),b&&t.isOpen&&t.close())},addOption:function(b){var c,d,e,f=this;if(a.isArray(b))for(c=0,d=b.length;c<d;c++)f.addOption(b[c]);else(e=f.registerOption(b))&&(f.userOptions[e]=!0,f.lastQuery=null,f.trigger("option_add",e,b))},registerOption:function(a){var b=z(a[this.settings.valueField]);return"undefined"!=typeof b&&null!==b&&!this.options.hasOwnProperty(b)&&(a.$order=a.$order||++this.order,this.options[b]=a,b)},registerOptionGroup:function(a){var b=z(a[this.settings.optgroupValueField]);return!!b&&(a.$order=a.$order||++this.order,this.optgroups[b]=a,b)},addOptionGroup:function(a,b){b[this.settings.optgroupValueField]=a,(a=this.registerOptionGroup(b))&&this.trigger("optgroup_add",a,b)},removeOptionGroup:function(a){this.optgroups.hasOwnProperty(a)&&(delete this.optgroups[a],this.renderCache={},this.trigger("optgroup_remove",a))},clearOptionGroups:function(){this.optgroups={},this.renderCache={},this.trigger("optgroup_clear")},updateOption:function(b,c){var d,e,f,g,h,i,j,k=this;if(b=z(b),f=z(c[k.settings.valueField]),null!==b&&k.options.hasOwnProperty(b)){if("string"!=typeof f)throw new Error("Value must be set in option data");j=k.options[b].$order,f!==b&&(delete k.options[b],g=k.items.indexOf(b),g!==-1&&k.items.splice(g,1,f)),c.$order=c.$order||j,k.options[f]=c,h=k.renderCache.item,i=k.renderCache.option,h&&(delete h[b],delete h[f]),i&&(delete i[b],delete i[f]),k.items.indexOf(f)!==-1&&(d=k.getItem(b),e=a(k.render("item",c)),d.hasClass("active")&&e.addClass("active"),d.replaceWith(e)),k.lastQuery=null,k.isOpen&&k.refreshOptions(!1)}},removeOption:function(a,b){var c=this;a=z(a);var d=c.renderCache.item,e=c.renderCache.option;d&&delete d[a],e&&delete e[a],delete c.userOptions[a],delete c.options[a],c.lastQuery=null,c.trigger("option_remove",a),c.removeItem(a,b)},clearOptions:function(){var a=this;a.loadedSearches={},a.userOptions={},a.renderCache={},a.options=a.sifter.items={},a.lastQuery=null,a.trigger("option_clear"),a.clear()},getOption:function(a){return this.getElementWithValue(a,this.$dropdown_content.find("[data-selectable]"))},getAdjacentOption:function(b,c){var d=this.$dropdown.find("[data-selectable]"),e=d.index(b)+c;return e>=0&&e<d.length?d.eq(e):a()},getElementWithValue:function(b,c){if(b=z(b),"undefined"!=typeof b&&null!==b)for(var d=0,e=c.length;d<e;d++)if(c[d].getAttribute("data-value")===b)return a(c[d]);return a()},getItem:function(a){return this.getElementWithValue(a,this.$control.children())},addItems:function(b,c){for(var d=a.isArray(b)?b:[b],e=0,f=d.length;e<f;e++)this.isPending=e<f-1,this.addItem(d[e],c)},addItem:function(b,c){var d=c?[]:["change"];E(this,d,function(){var d,e,f,g,h,i=this,j=i.settings.mode;return b=z(b),i.items.indexOf(b)!==-1?void("single"===j&&i.close()):void(i.options.hasOwnProperty(b)&&("single"===j&&i.clear(c),"multi"===j&&i.isFull()||(d=a(i.render("item",i.options[b])),h=i.isFull(),i.items.splice(i.caretPos,0,b),i.insertAtCaret(d),(!i.isPending||!h&&i.isFull())&&i.refreshState(),i.isSetup&&(f=i.$dropdown_content.find("[data-selectable]"),i.isPending||(e=i.getOption(b),g=i.getAdjacentOption(e,1).attr("data-value"),i.refreshOptions(i.isFocused&&"single"!==j),g&&i.setActiveOption(i.getOption(g))),!f.length||i.isFull()?i.close():i.positionDropdown(),i.updatePlaceholder(),i.trigger("item_add",b,d),i.updateOriginalInput({silent:c})))))})},removeItem:function(b,c){var d,e,f,g=this;d=b instanceof a?b:g.getItem(b),b=z(d.attr("data-value")),e=g.items.indexOf(b),e!==-1&&(d.remove(),d.hasClass("active")&&(f=g.$activeItems.indexOf(d[0]),g.$activeItems.splice(f,1)),g.items.splice(e,1),g.lastQuery=null,!g.settings.persist&&g.userOptions.hasOwnProperty(b)&&g.removeOption(b,c),e<g.caretPos&&g.setCaret(g.caretPos-1),g.refreshState(),g.updatePlaceholder(),g.updateOriginalInput({silent:c}),g.positionDropdown(),g.trigger("item_remove",b,d))},createItem:function(b,c){var d=this,e=d.caretPos;b=b||a.trim(d.$control_input.val()||"");var f=arguments[arguments.length-1];if("function"!=typeof f&&(f=function(){}),"boolean"!=typeof c&&(c=!0),!d.canCreate(b))return f(),!1;d.lock();var g="function"==typeof d.settings.create?this.settings.create:function(a){var b={};return b[d.settings.labelField]=a,b[d.settings.valueField]=a,b},h=C(function(a){if(d.unlock(),!a||"object"!=typeof a)return f();var b=z(a[d.settings.valueField]);return"string"!=typeof b?f():(d.setTextboxValue(""),d.addOption(a),d.setCaret(e),d.addItem(b),d.refreshOptions(c&&"single"!==d.settings.mode),void f(a))}),i=g.apply(this,[b,h]);return"undefined"!=typeof i&&h(i),!0},refreshItems:function(){this.lastQuery=null,this.isSetup&&this.addItem(this.items),this.refreshState(),this.updateOriginalInput()},refreshState:function(){this.refreshValidityState(),this.refreshClasses()},refreshValidityState:function(){if(!this.isRequired)return!1;var a=!this.items.length;this.isInvalid=a,this.$control_input.prop("required",a),this.$input.prop("required",!a)},refreshClasses:function(){var b=this,c=b.isFull(),d=b.isLocked;b.$wrapper.toggleClass("rtl",b.rtl),b.$control.toggleClass("focus",b.isFocused).toggleClass("disabled",b.isDisabled).toggleClass("required",b.isRequired).toggleClass("invalid",b.isInvalid).toggleClass("locked",d).toggleClass("full",c).toggleClass("not-full",!c).toggleClass("input-active",b.isFocused&&!b.isInputHidden).toggleClass("dropdown-active",b.isOpen).toggleClass("has-options",!a.isEmptyObject(b.options)).toggleClass("has-items",b.items.length>0),b.$control_input.data("grow",!c&&!d)},isFull:function(){return null!==this.settings.maxItems&&this.items.length>=this.settings.maxItems},updateOriginalInput:function(a){var b,c,d,e,f=this;if(a=a||{},f.tagType===v){for(d=[],b=0,c=f.items.length;b<c;b++)e=f.options[f.items[b]][f.settings.labelField]||"",d.push('<option value="'+A(f.items[b])+'" selected="selected">'+A(e)+"</option>");d.length||this.$input.attr("multiple")||d.push('<option value="" selected="selected"></option>'),
f.$input.html(d.join(""))}else f.$input.val(f.getValue()),f.$input.attr("value",f.$input.val());f.isSetup&&(a.silent||f.trigger("change",f.$input.val()))},updatePlaceholder:function(){if(this.settings.placeholder){var a=this.$control_input;this.items.length?a.removeAttr("placeholder"):a.attr("placeholder",this.settings.placeholder),a.triggerHandler("update",{force:!0})}},open:function(){var a=this;a.isLocked||a.isOpen||"multi"===a.settings.mode&&a.isFull()||(a.focus(),a.isOpen=!0,a.refreshState(),a.$dropdown.css({visibility:"hidden",display:"block"}),a.positionDropdown(),a.$dropdown.css({visibility:"visible"}),a.trigger("dropdown_open",a.$dropdown))},close:function(){var a=this,b=a.isOpen;"single"===a.settings.mode&&a.items.length&&(a.hideInput(),a.$control_input.blur()),a.isOpen=!1,a.$dropdown.hide(),a.setActiveOption(null),a.refreshState(),b&&a.trigger("dropdown_close",a.$dropdown)},positionDropdown:function(){var a=this.$control,b="body"===this.settings.dropdownParent?a.offset():a.position();b.top+=a.outerHeight(!0),this.$dropdown.css({width:a.outerWidth(),top:b.top,left:b.left})},clear:function(a){var b=this;b.items.length&&(b.$control.children(":not(input)").remove(),b.items=[],b.lastQuery=null,b.setCaret(0),b.setActiveItem(null),b.updatePlaceholder(),b.updateOriginalInput({silent:a}),b.refreshState(),b.showInput(),b.trigger("clear"))},insertAtCaret:function(b){var c=Math.min(this.caretPos,this.items.length);0===c?this.$control.prepend(b):a(this.$control[0].childNodes[c]).before(b),this.setCaret(c+1)},deleteSelection:function(b){var c,d,e,f,g,h,i,j,k,l=this;if(e=b&&b.keyCode===p?-1:1,f=G(l.$control_input[0]),l.$activeOption&&!l.settings.hideSelected&&(i=l.getAdjacentOption(l.$activeOption,-1).attr("data-value")),g=[],l.$activeItems.length){for(k=l.$control.children(".active:"+(e>0?"last":"first")),h=l.$control.children(":not(input)").index(k),e>0&&h++,c=0,d=l.$activeItems.length;c<d;c++)g.push(a(l.$activeItems[c]).attr("data-value"));b&&(b.preventDefault(),b.stopPropagation())}else(l.isFocused||"single"===l.settings.mode)&&l.items.length&&(e<0&&0===f.start&&0===f.length?g.push(l.items[l.caretPos-1]):e>0&&f.start===l.$control_input.val().length&&g.push(l.items[l.caretPos]));if(!g.length||"function"==typeof l.settings.onDelete&&l.settings.onDelete.apply(l,[g])===!1)return!1;for("undefined"!=typeof h&&l.setCaret(h);g.length;)l.removeItem(g.pop());return l.showInput(),l.positionDropdown(),l.refreshOptions(!0),i&&(j=l.getOption(i),j.length&&l.setActiveOption(j)),!0},advanceSelection:function(a,b){var c,d,e,f,g,h,i=this;0!==a&&(i.rtl&&(a*=-1),c=a>0?"last":"first",d=G(i.$control_input[0]),i.isFocused&&!i.isInputHidden?(f=i.$control_input.val().length,g=a<0?0===d.start&&0===d.length:d.start===f,g&&!f&&i.advanceCaret(a,b)):(h=i.$control.children(".active:"+c),h.length&&(e=i.$control.children(":not(input)").index(h),i.setActiveItem(null),i.setCaret(a>0?e+1:e))))},advanceCaret:function(a,b){var c,d,e=this;0!==a&&(c=a>0?"next":"prev",e.isShiftDown?(d=e.$control_input[c](),d.length&&(e.hideInput(),e.setActiveItem(d),b&&b.preventDefault())):e.setCaret(e.caretPos+a))},setCaret:function(b){var c=this;if(b="single"===c.settings.mode?c.items.length:Math.max(0,Math.min(c.items.length,b)),!c.isPending){var d,e,f,g;for(f=c.$control.children(":not(input)"),d=0,e=f.length;d<e;d++)g=a(f[d]).detach(),d<b?c.$control_input.before(g):c.$control.append(g)}c.caretPos=b},lock:function(){this.close(),this.isLocked=!0,this.refreshState()},unlock:function(){this.isLocked=!1,this.refreshState()},disable:function(){var a=this;a.$input.prop("disabled",!0),a.$control_input.prop("disabled",!0).prop("tabindex",-1),a.isDisabled=!0,a.lock()},enable:function(){var a=this;a.$input.prop("disabled",!1),a.$control_input.prop("disabled",!1).prop("tabindex",a.tabIndex),a.isDisabled=!1,a.unlock()},destroy:function(){var b=this,c=b.eventNS,d=b.revertSettings;b.trigger("destroy"),b.off(),b.$wrapper.remove(),b.$dropdown.remove(),b.$input.html("").append(d.$children).removeAttr("tabindex").removeClass("selectized").attr({tabindex:d.tabindex}).show(),b.$control_input.removeData("grow"),b.$input.removeData("selectize"),a(window).off(c),a(document).off(c),a(document.body).off(c),delete b.$input[0].selectize},render:function(b,c){var d,e,f="",g=!1,h=this;return"option"!==b&&"item"!==b||(d=z(c[h.settings.valueField]),g=!!d),g&&(y(h.renderCache[b])||(h.renderCache[b]={}),h.renderCache[b].hasOwnProperty(d))?h.renderCache[b][d]:(f=a(h.settings.render[b].apply(this,[c,A])),"option"===b||"option_create"===b?f.attr("data-selectable",""):"optgroup"===b&&(e=c[h.settings.optgroupValueField]||"",f.attr("data-group",e)),"option"!==b&&"item"!==b||f.attr("data-value",d||""),g&&(h.renderCache[b][d]=f[0]),f[0])},clearCache:function(a){var b=this;"undefined"==typeof a?b.renderCache={}:delete b.renderCache[a]},canCreate:function(a){var b=this;if(!b.settings.create)return!1;var c=b.settings.createFilter;return a.length&&("function"!=typeof c||c.apply(b,[a]))&&("string"!=typeof c||new RegExp(c).test(a))&&(!(c instanceof RegExp)||c.test(a))}}),M.count=0,M.defaults={options:[],optgroups:[],plugins:[],delimiter:",",splitOn:null,persist:!0,diacritics:!0,create:!1,createOnBlur:!1,createFilter:null,highlight:!0,openOnFocus:!0,maxOptions:1e3,maxItems:null,hideSelected:null,addPrecedence:!1,selectOnTab:!1,preload:!1,allowEmptyOption:!1,closeAfterSelect:!1,scrollDuration:60,loadThrottle:300,loadingClass:"loading",dataAttr:"data-data",optgroupField:"optgroup",valueField:"value",labelField:"text",optgroupLabelField:"label",optgroupValueField:"value",lockOptgroupOrder:!1,sortField:"$order",searchField:["text"],searchConjunction:"and",mode:null,wrapperClass:"selectize-control",inputClass:"selectize-input",dropdownClass:"selectize-dropdown",dropdownContentClass:"selectize-dropdown-content",dropdownParent:null,copyClassesToDropdown:!0,render:{}},a.fn.selectize=function(b){var c=a.fn.selectize.defaults,d=a.extend({},c,b),e=d.dataAttr,f=d.labelField,g=d.valueField,h=d.optgroupField,i=d.optgroupLabelField,j=d.optgroupValueField,k=function(b,c){var h,i,j,k,l=b.attr(e);if(l)for(c.options=JSON.parse(l),h=0,i=c.options.length;h<i;h++)c.items.push(c.options[h][g]);else{var m=a.trim(b.val()||"");if(!d.allowEmptyOption&&!m.length)return;for(j=m.split(d.delimiter),h=0,i=j.length;h<i;h++)k={},k[f]=j[h],k[g]=j[h],c.options.push(k);c.items=j}},l=function(b,c){var k,l,m,n,o=c.options,p={},q=function(a){var b=e&&a.attr(e);return"string"==typeof b&&b.length?JSON.parse(b):null},r=function(b,e){b=a(b);var i=z(b.val());if(i||d.allowEmptyOption)if(p.hasOwnProperty(i)){if(e){var j=p[i][h];j?a.isArray(j)?j.push(e):p[i][h]=[j,e]:p[i][h]=e}}else{var k=q(b)||{};k[f]=k[f]||b.text(),k[g]=k[g]||i,k[h]=k[h]||e,p[i]=k,o.push(k),b.is(":selected")&&c.items.push(i)}},s=function(b){var d,e,f,g,h;for(b=a(b),f=b.attr("label"),f&&(g=q(b)||{},g[i]=f,g[j]=f,c.optgroups.push(g)),h=a("option",b),d=0,e=h.length;d<e;d++)r(h[d],f)};for(c.maxItems=b.attr("multiple")?null:1,n=b.children(),k=0,l=n.length;k<l;k++)m=n[k].tagName.toLowerCase(),"optgroup"===m?s(n[k]):"option"===m&&r(n[k])};return this.each(function(){if(!this.selectize){var e,f=a(this),g=this.tagName.toLowerCase(),h=f.attr("placeholder")||f.attr("data-placeholder");h||d.allowEmptyOption||(h=f.children('option[value=""]').text());var i={placeholder:h,options:[],optgroups:[],items:[]};"select"===g?l(f,i):k(f,i),e=new M(f,a.extend(!0,{},c,i,b))}})},a.fn.selectize.defaults=M.defaults,a.fn.selectize.support={validity:x},M.define("drag_drop",function(b){if(!a.fn.sortable)throw new Error('The "drag_drop" plugin requires jQuery UI "sortable".');if("multi"===this.settings.mode){var c=this;c.lock=function(){var a=c.lock;return function(){var b=c.$control.data("sortable");return b&&b.disable(),a.apply(c,arguments)}}(),c.unlock=function(){var a=c.unlock;return function(){var b=c.$control.data("sortable");return b&&b.enable(),a.apply(c,arguments)}}(),c.setup=function(){var b=c.setup;return function(){b.apply(this,arguments);var d=c.$control.sortable({items:"[data-value]",forcePlaceholderSize:!0,disabled:c.isLocked,start:function(a,b){b.placeholder.css("width",b.helper.css("width")),d.css({overflow:"visible"})},stop:function(){d.css({overflow:"hidden"});var b=c.$activeItems?c.$activeItems.slice():null,e=[];d.children("[data-value]").each(function(){e.push(a(this).attr("data-value"))}),c.setValue(e),c.setActiveItem(b)}})}}()}}),M.define("dropdown_header",function(b){var c=this;b=a.extend({title:"Untitled",headerClass:"selectize-dropdown-header",titleRowClass:"selectize-dropdown-header-title",labelClass:"selectize-dropdown-header-label",closeClass:"selectize-dropdown-header-close",html:function(a){return'<div class="'+a.headerClass+'"><div class="'+a.titleRowClass+'"><span class="'+a.labelClass+'">'+a.title+'</span><a href="javascript:void(0)" class="'+a.closeClass+'">&times;</a></div></div>'}},b),c.setup=function(){var d=c.setup;return function(){d.apply(c,arguments),c.$dropdown_header=a(b.html(b)),c.$dropdown.prepend(c.$dropdown_header)}}()}),M.define("optgroup_columns",function(b){var c=this;b=a.extend({equalizeWidth:!0,equalizeHeight:!0},b),this.getAdjacentOption=function(b,c){var d=b.closest("[data-group]").find("[data-selectable]"),e=d.index(b)+c;return e>=0&&e<d.length?d.eq(e):a()},this.onKeyDown=function(){var a=c.onKeyDown;return function(b){var d,e,f,g;return!this.isOpen||b.keyCode!==j&&b.keyCode!==m?a.apply(this,arguments):(c.ignoreHover=!0,g=this.$activeOption.closest("[data-group]"),d=g.find("[data-selectable]").index(this.$activeOption),g=b.keyCode===j?g.prev("[data-group]"):g.next("[data-group]"),f=g.find("[data-selectable]"),e=f.eq(Math.min(f.length-1,d)),void(e.length&&this.setActiveOption(e)))}}();var d=function(){var a,b=d.width,c=document;return"undefined"==typeof b&&(a=c.createElement("div"),a.innerHTML='<div style="width:50px;height:50px;position:absolute;left:-50px;top:-50px;overflow:auto;"><div style="width:1px;height:100px;"></div></div>',a=a.firstChild,c.body.appendChild(a),b=d.width=a.offsetWidth-a.clientWidth,c.body.removeChild(a)),b},e=function(){var e,f,g,h,i,j,k;if(k=a("[data-group]",c.$dropdown_content),f=k.length,f&&c.$dropdown_content.width()){if(b.equalizeHeight){for(g=0,e=0;e<f;e++)g=Math.max(g,k.eq(e).height());k.css({height:g})}b.equalizeWidth&&(j=c.$dropdown_content.innerWidth()-d(),h=Math.round(j/f),k.css({width:h}),f>1&&(i=j-h*(f-1),k.eq(f-1).css({width:i})))}};(b.equalizeHeight||b.equalizeWidth)&&(B.after(this,"positionDropdown",e),B.after(this,"refreshOptions",e))}),M.define("remove_button",function(b){b=a.extend({label:"&times;",title:"Remove",className:"remove",append:!0},b);var c=function(b,c){c.className="remove-single";var d=b,e='<a href="javascript:void(0)" class="'+c.className+'" tabindex="-1" title="'+A(c.title)+'">'+c.label+"</a>",f=function(a,b){return a+b};b.setup=function(){var g=d.setup;return function(){if(c.append){var h=a(d.$input.context).attr("id"),i=(a("#"+h),d.settings.render.item);d.settings.render.item=function(a){return f(i.apply(b,arguments),e)}}g.apply(b,arguments),b.$control.on("click","."+c.className,function(a){a.preventDefault(),d.isLocked||d.clear()})}}()},d=function(b,c){var d=b,e='<a href="javascript:void(0)" class="'+c.className+'" tabindex="-1" title="'+A(c.title)+'">'+c.label+"</a>",f=function(a,b){var c=a.search(/(<\/[^>]+>\s*)$/);return a.substring(0,c)+b+a.substring(c)};b.setup=function(){var g=d.setup;return function(){if(c.append){var h=d.settings.render.item;d.settings.render.item=function(a){return f(h.apply(b,arguments),e)}}g.apply(b,arguments),b.$control.on("click","."+c.className,function(b){if(b.preventDefault(),!d.isLocked){var c=a(b.currentTarget).parent();d.setActiveItem(c),d.deleteSelection()&&d.setCaret(d.items.length)}})}}()};return"single"===this.settings.mode?void c(this,b):void d(this,b)}),M.define("restore_on_backspace",function(a){var b=this;a.text=a.text||function(a){return a[this.settings.labelField]},this.onKeyDown=function(){var c=b.onKeyDown;return function(b){var d,e;return b.keyCode===p&&""===this.$control_input.val()&&!this.$activeItems.length&&(d=this.caretPos-1,d>=0&&d<this.items.length)?(e=this.options[this.items[d]],this.deleteSelection(b)&&(this.setTextboxValue(a.text.apply(this,[e])),this.refreshOptions(!0)),void b.preventDefault()):c.apply(this,arguments)}}()}),M});
(function ($)
{

	var Module_Favorites = function ()
	{
		var module = this;

		$(document).ready(function ()
		{
			module.init();
		})

		this.getStorage = function(key)
		{
			return window.localStorage[key] ? JSON.parse(window.localStorage[key]) : [];
		}

		this.saveStorage = function(newValue)
		{
			window.localStorage.favorites = JSON.stringify(newValue);
		}

		this.getFavorites = function ()
		{
			return this.getStorage('favorites');
		}

		this.saveFavorite = function (page)
		{
			if (this.isFavorite(page))
			{
				return;
			}

			var newStorage = this.getFavorites();
			newStorage.push(page);
			this.saveStorage(newStorage);

			Analytics.track('Favorite Scholarship', {
				'Scholarship id': page.id
			});

			this.render();
		}

		this.removeFavorite = function (page)
		{
			var storage = this.getFavorites();
			for (var i = 0; i < storage.length; i++)
			{
				if (storage[i].id == page.id)
				{
					storage.splice(i, 1);
				}
			}
			this.saveStorage(storage);

			this.render();

			Analytics.track('Unfavorite Scholarship', {
				'Scholarship id': page.id
			});
		}

		this.isFavorite = function (page)
		{
			var storage = this.getStorage('favorites');
			for (var i = 0; i < storage.length; i++)
			{
				if (storage[i].id == page.id) return true;
			}
			return false;
		}

		this.init = function ()
		{
			var self = this;

			this.render();

			if (typeof Page !== 'undefined')
			{
				$('.js-favorite-save').click(function (e)
				{
					e.preventDefault();
					self.isFavorite(Page) ? self.removeFavorite(Page) : self.saveFavorite(Page);
				});
			}
		}

		this.render = function ()
		{
			this.renderFavoritesMenu();

			if (typeof Page !== 'undefined')
			{
				var pageIsFavorite = this.isFavorite(Page);

				$('.js-favorite-save').find('.fa')
					.toggleClass('fa-bookmark', pageIsFavorite)
					.toggleClass('fa-bookmark-o', ! pageIsFavorite)
				;
			}
		}

		this.renderFavoritesMenu = function()
		{
			var favorites = module.getFavorites();
			var $favoritesList = [];
			if (favorites.length)
			{
				for (var i = 0; i < favorites.length; i++)
				{
					var $element = $('<li class="dropdown__item"><a class="dropdown__link" href="' + favorites[i].url + '">' + favorites[i].title + '</a></li>');
					$favoritesList.push($element);
				}
			}
			else
			{
				$favoritesList.push($('<li class="dropdown__item"><span class="dropdown__span">You haven\'t saved any scholarships yet. How about starting your search <a href="/">here</a>.</span></li>'));
			}
			
			$('.js-favorites-list').html($favoritesList);
		}
	};
	window.Favorites = new Module_Favorites();

}(jQuery));
var Module_Analytics = function ()
{
	var module = this;

	this.track = function (name, properties, callback)
	{
		// add basic properties
		var addedProps = {
			'Page url': window.location.href,
			'Page path': window.location.pathname,
			'Page title': document.title
		};

		// add campaign params
		addParam('Campaign source', 'utm_source', addedProps);
		addParam('Campaign medium', 'utm_medium', addedProps);
		addParam('Campaign name', 'utm_campaign', addedProps);
		addParam('Campaign term', 'utm_term', addedProps);
		addParam('Campaign content', 'utm_content', addedProps);

		// add referrer if it exists
		if (document.referrer)
		{
			addedProps['Referrer url'] = document.referrer;
		}

		// add the properties coming from individual event
		var sendProps = $.extend(addedProps, properties);

		var promises = [];
		promises['amplitude'] = amplitude.getInstance().logEvent(name, sendProps);
		promises['vero'] = _veroq.push(['track', name, sendProps]);

		if (callback)
		{
			$.when.apply($, promises).done(function(schemas) 
			{
				callback();
			});
		}
		
	}


	this.identify = function (userProperties, callback)
	{
		if (userProperties.email && typeof userProperties.email == 'string' && userProperties.email.length > 0)
		{
			amplitude.getInstance().setUserId(userProperties.email);
		}
		amplitude.getInstance().setUserProperties(userProperties);

		_veroq.push(['user', userProperties]);
	}



	function addParam (name, param, obj)
	{
		if (getParam(param)) { obj[name] = getParam(param) };
	}



	function getParam (param)
	{
		var vars = {};
		window.location.href.replace( location.hash, '' ).replace( 
			/[?&]+([^=&]+)=?([^&]*)?/gi, // regexp
			function( m, key, value ) { // callback
				vars[key] = value !== undefined ? value : '';
			}
		);

		if ( param ) {
			return vars[param] ? vars[param] : null;	
		}
		return vars;
	}
}

window.Analytics = new Module_Analytics();

(function( $ ) 
{
	$.fn.dropdown = function ()
	{
		return this.each(function() 
		{
			var $wrap = $(this).parents('.dropdown__wrap'),
				$link = $wrap.find('.dropdown__trigger'),
				$menu = $wrap.find('.dropdown');

			$link.on('click', function (e)
			{
				e.preventDefault();
				e.stopPropagation();
				$menu.removeClass('is-hidden'); 
			});

			$menu.click(function (e)
			{
				e.stopPropagation();
			});

			$(document).click(function ()
			{
				$menu.addClass('is-hidden');
			});
	    });
	}

	$(document).ready(function ()
	{
		$('.dropdown').dropdown();
	});

}(jQuery));
window.Modal = function (modalType)
{
	var self = this;

	var $element = $('.js-modal-' + modalType),
		$backdrop = $element.find('.modal__backdrop'),
		$closeBtn = $element.find('.modal__close'),
		$body = $('body');

	$closeBtn.click(function ()
	{
		self.close();
	});

	$backdrop.click(function ()
	{
		self.close();
	});

	$('document').keyup(function (e)
	{
		if (e.keyCode == 27) self.close();
	});

	this.open = function ()
	{
		$element.removeClass('is-hidden');
		$body.addClass('is-no-scroll');
		Analytics.track('Show Modal', {
			type: modalType
		});
	};

	this.close = function ()
	{
		$element.addClass('is-hidden');
		$body.removeClass('is-no-scroll');
		Analytics.track('Close Modal', {
			type: modalType
		});
	};

	this.getElement = function ()
	{
		return $element;
	}
};


$('document').ready(function ()
{
	$('[data-modal-toggle]').click(function (e)
	{
		var modal = new Modal($(this).attr('data-modal-toggle'));
		modal.open();
	});
});

$(function ()
{
	var $form = $('.js-newsletter-form');
	$form.on('submit', function (e)
	{
		e.preventDefault();
		var form = e.currentTarget;

		if (!form.email.value || !form.name.value)
		{
			return;
		}

		$.post(form.action, {
			email: form.email.value,
			name: form.name.value,
			location: form.location.value,
			type: form.type.value
		}, function (data)
		{
			if (typeof location.origin === 'undefined')
				location.origin = location.protocol + '//' + location.host;

			Analytics.identify({
				name: form.name.value,
				email: form.email.value,
				type: form.type.value
			});

			Analytics.track('Subscribe', {
				type: form.type.value
			});

			form.name.value = '';
			form.email.value = '';

			var $alertContainer = $form.find('.js-newsletter-alert')
				.removeClass('is-hidden')
				.html($form.data('confirmation'));
		});
	});
});

(function ($)
{

	$('.js-select-url').change(function (e)
	{
		window.location.href = e.currentTarget.value;
	})

}(jQuery));
(function ($)
{
	$.fn.tooltip = function ()
	{
		return this.each(function() 
		{
			$(this)
				.addClass('tooltip__wrap')
				.append(function (){
					return '<div class="tooltip">' + $(this).data('tooltip') + '</div>';
				});
	    });
	}

	$(document).ready(function ()
	{
		$('[data-tooltip]').tooltip();
	});

}(jQuery));
(function( $ ) 
{
	$(document).ready(function ()
	{
		$('.js-scholarship-search').change(function (e)
		{
			$('.js-scholarship-form').submit();
		});



		$('.js-select').selectize();



		$('.js-editor').wysiwyg({
			toolbar: 'selection'|'top'|'top-focus'|'top-selection'|'top-focus-selection'|'bottom'|'bottom-focus'|'bottom-selection'|'bottom-focus-selection',
			buttons: {
				bold: {
					image: '\uf032'
				},
				italic: {
					image: '\uf033'
				},
				orderedList: {
					image: '\uf0cb'
				},
				unorderedList: {
					image: '\uf0ca'
				},
				removeformat: {
					image: '\uf12d'
				}
			}
		});
	})
	
}(jQuery));


$.ajaxSetup({
    headers: {
        'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
    }
})

//# sourceMappingURL=all.js.map
