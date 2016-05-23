define([
    "mvc/list/list-view",
    "mvc/history/history-model",
    "mvc/history/history-contents",
    "mvc/history/history-preferences",
    "mvc/history/hda-li",
    "mvc/history/hdca-li",
    "mvc/user/user-model",
    "mvc/ui/error-modal",
    "ui/fa-icon-button",
    "mvc/base-mvc",
    "utils/localization",
    "ui/search-input",
    "ui/scrollable-pages"
], function(
    LIST_VIEW,
    HISTORY_MODEL,
    HISTORY_CONTENTS,
    HISTORY_PREFS,
    HDA_LI,
    HDCA_LI,
    USER,
    ERROR_MODAL,
    faIconButton,
    BASE_MVC,
    _l
){
'use strict';

/* =============================================================================
TODO:

============================================================================= */
/** @class  non-editable, read-only View/Controller for a history model.
 *  Allows:
 *      changing the loaded history
 *      displaying data, info, and download
 *      tracking history attrs: size, tags, annotations, name, etc.
 *  Does not allow:
 *      changing the name
 */
var _super = LIST_VIEW.ModelListPanel;
var HistoryView = _super.extend(
/** @lends HistoryView.prototype */{
    _logNamespace : 'history',

    /** class to use for constructing the HDA views */
    HDAViewClass        : HDA_LI.HDAListItemView,
    /** class to use for constructing the HDCA views */
    HDCAViewClass       : HDCA_LI.HDCAListItemView,
    /** class to used for constructing collection of sub-view models */
    collectionClass     : HISTORY_CONTENTS.HistoryContents,
    /** key of attribute in model to assign to this.collection */
    modelCollectionKey  : 'contents',

    tagName             : 'div',
    className           : _super.prototype.className + ' history-panel',

    /** string to display when the collection is empty */
    emptyMsg            : _l( 'This history is empty' ),
    /** displayed when no items match the search terms */
    noneFoundMsg        : _l( 'No matching datasets found' ),
    /** string used for search placeholder */
    searchPlaceholder   : _l( 'search datasets' ),

    // ......................................................................... SET UP
    /** Set up the view, bind listeners.
     *  @param {Object} attributes optional settings for the panel
     */
    initialize : function( attributes ){
        _super.prototype.initialize.call( this, attributes );
        // ---- instance vars
        // control contents/behavior based on where (and in what context) the panel is being used
        /** where should pages from links be displayed? (default to new tab/window) */
        this.linkTarget = attributes.linkTarget || '_blank';
    },

    /** create and return a collection for when none is initially passed */
    _createDefaultCollection : function(){
        // override
        console.log( '((history-view)_createDefaultCollection)' );
        return new this.collectionClass([], { history: this.model });
    },

    /** In this override, clear the update timer on the model */
    freeModel : function(){
        _super.prototype.freeModel.call( this );
        if( this.model ){
            this.model.clearUpdateTimeout();
        }
        return this;
    },

    /** create any event listeners for the panel
     *  @fires: rendered:initial    on the first render
     *  @fires: empty-history       when switching to a history with no contents or creating a new history
     */
    _setUpListeners : function(){
        _super.prototype._setUpListeners.call( this );
        this.on({
            error : function( model, xhr, options, msg, details ){
                this.errorHandler( model, xhr, options, msg, details );
            },
            'loading-done' : function(){
                this.render();
                if( !this.views.length ){
                    this.trigger( 'empty-history', this );
                }
            },
            'views:ready view:attached view:removed' : function( view ){
                this._renderSelectButton();
            }
        });
        // this.on( 'all', function(){ console.debug( arguments ); });
    },

    // ------------------------------------------------------------------------ loading history/hda models
    /** @type {Number} ms to wait after history load to fetch/decorate hdcas with element_count */
    FETCH_COLLECTION_COUNTS_DELAY : 2000,

    /** load the history with the given id then it's contents, sending ajax options to both */
    loadHistory : function( historyId, options, contentsOptions ){
        contentsOptions = _.extend( contentsOptions || { silent: true });
        this.info( 'loadHistory:', historyId, options, contentsOptions );
        var self = this;
        self.setModel( new HISTORY_MODEL.History({ id : historyId }) );

        self.trigger( 'loading' );
        return self.model
            .fetchWithContents( options, contentsOptions )
            // .done( function(){
            //     // after the initial load, decorate with more time consuming fields (like HDCA element_counts)
            //     _.delay( function(){
            //         // self.model.contents.fetchCollectionCounts();
            //     }, self.FETCH_COLLECTION_COUNTS_DELAY );
            // })
            .always( function(){
                self.trigger( 'loading-done' );
            });
    },

    /** convenience alias to the model. Updates the item list only (not the history) */
    refreshContents : function( options ){
        if( this.model ){
            return this.model.refresh( options );
        }
        // may have callbacks - so return an empty promise
        return $.when();
    },

    /** Override to reset web storage when the id changes (since it needs the id) */
    _setUpCollectionListeners : function(){
        _super.prototype._setUpCollectionListeners.call( this );
        return this.listenTo( this.collection, {
            // 'all' : function(){ console.log( this.collection + ':', arguments ); },
            'fetching-more'     : this.showContentsLoadingIndicator,
            'fetching-more-done': this.hideContentsLoadingIndicator,
        });
    },

    // ------------------------------------------------------------------------ panel rendering
    /** In this override, add a btn to toggle the selectors */
    render : function( speed ){
        _super.prototype.render.call( this, speed );

        if( this.model.contents._countSections() > 2 ){
            console.log( 'list len:',  this.$list().length );
            this.$list().scrollablePages();
            this.$list().on( 'scrollable-pages.page-change', _.bind( this.onPageChange, this ));
        }
        return this;
    },

    onPageChange : function( ev ){
        console.log( '_pageScroll', ev );
        var section = this.model.contents._lastSection() - ev.newPage;
        this.model.contents.currentSection = section;
        console.log( 'section:', section );
        this.loadAndRenderSection( section );
    },

    loadAndRenderSection : function( section, options ){
        options = options || {};
        var self = this;
        var contents = self.model.contents;
        return self.model.contents.fetchSection( section, { silent: true })
            .done( function(){
                if( !self.$section( section ).children( '.history-content' ).length ){
                    self._renderSection( section );
                }
            });
    },

    /** In this override, add a btn to toggle the selectors */
    _buildNewRender : function(){
        var $newRender = _super.prototype._buildNewRender.call( this );
        this._renderSelectButton( $newRender );
        return $newRender;
    },

    /** override to avoid showing intial empty message using contents_active */
    _renderEmptyMessage : function( $whereTo ){
        var self = this;
        var $emptyMsg = self.$emptyMessage( $whereTo );

        var empty = self.model.get( 'contents_active' ).active <= 0;
        if( empty ){
            return $emptyMsg.empty().append( self.emptyMsg ).show();

        } else if( self.searchFor && self.model.contents.haveSearchDetails() && !self.views.length ){
            return $emptyMsg.empty().append( self.noneFoundMsg ).show();
        }
        return $();
    },

    /** button for starting select mode */
    _renderSelectButton : function( $where ){
        $where = $where || this.$el;
        // do not render selector option if no actions
        if( !this.multiselectActions().length ){
            return null;
        }
        // do not render (and remove even) if nothing to select
        if( !this.views.length ){
            this.hideSelectors();
            $where.find( '.controls .actions .show-selectors-btn' ).remove();
            return null;
        }
        // don't bother rendering if there's one already
        var $existing = $where.find( '.controls .actions .show-selectors-btn' );
        if( $existing.length ){
            return $existing;
        }

        return faIconButton({
            title   : _l( 'Operations on multiple datasets' ),
            classes : 'show-selectors-btn',
            faIcon  : 'fa-check-square-o'
        }).prependTo( $where.find( '.controls .actions' ) );
    },

    // ------------------------------------------------------------------------ client-side pagination
    /**  */
    renderItems : function( $whereTo ){
        $( '.tooltip' ).remove();

        // console.log( 'renderItems -----------------------------------------------------------' );
        $whereTo = $whereTo || this.$el;
        var self = this;
        var contents = self.model.contents;
        var hidsPerSection = contents.hidsPerSection;
        var empty = self.model.get( 'contents_active' ).active <= 0;

        // self.freeViews();
        self.views = [];
        // render sections
        // console.log( 'renderItems:', self.$list( $whereTo ) );
        self.$list( $whereTo ).html( contents._mapSectionRanges( function( section ){
            // console.log( 'renderItems:', section );
            return self.templates.listItemsSection( section, self );
        }).join( '\n' ));
        // render content views into (only) the current section
        // self.views = self._renderSection( this.model.contents.currentSection, $whereTo );
        self.views = self._renderSection( contents.currentSection, $whereTo );

        if( empty ){
            self.$list( $whereTo ).hide();
            self._renderEmptyMessage( $whereTo );
        }
        self.$list().scrollablePages( 'updateViewport' );

        self.trigger( 'views:ready', self.views );
        // console.log( '----------------------------------------------------------- renderItems' );
        return self.views;
    },

    _renderSection : function( section, $whereTo ){
        // // console.debug( this + '._renderSection', section, $whereTo );
        // var self = this;
        // // render views from collection for the current section, replacing that section marker with them
        // // note: shows only one section's worth of views at a time
        // var views = [];
        // var sectionModels = self.model.contents._filterSectionCollection( section, _.bind( this._filterItem, this ) );
        // self.$section( section, $whereTo ).append( sectionModels.map( function( itemModel ){
        //     var view = self._createItemView( itemModel );
        //     views.push( view );
        //     return self._renderItemView$el( view );
        // }));
        // return views;

        // console.debug( this + '._renderSection', section, $whereTo );
        var self = this;
        // render views from collection for the current section, replacing that section marker with them
        // note: shows only one section's worth of views at a time
        var sectionModels = self.model.contents._filterSectionCollection( section, _.bind( this._filterItem, this ) );
        var views = self._modelsToViews( sectionModels );
        self.$section( section, $whereTo ).append( views.map( function( view ){
            // console.log( 'view.$el.children()', view.el.children.length );
            return view.delegateEvents().el.children.length? view.$el : self._renderItemView$el( view );
        }));
        return views;
    },

    /**  */
    $section : function( section, $where ){
        return this.$list( $where ).find( '.list-items-section[data-section="' + section + '"]' );
    },

    /**  */
    $currentSection : function( $where ){
        return this.$list( $where ).find( '.list-items-section.current-section' );
    },

    // ------------------------------------------------------------------------ sub-views
    /** in this override, check if the contents would also display based on includeDeleted/hidden */
    _filterItem : function( model ){
        var self = this;
        var contents = self.model.contents;
        return ( contents.includeHidden  || !model.hidden() )
            && ( contents.includeDeleted || !model.isDeletedOrPurged() )
            && ( _super.prototype._filterItem.call( self, model ) );
    },

    /** In this override, since history contents are mixed,
     *      get the appropo view class based on history_content_type
     */
    _getItemViewClass : function( model ){
        var contentType = model.get( "history_content_type" );
        switch( contentType ){
            case 'dataset':
                return this.HDAViewClass;
            case 'dataset_collection':
                return this.HDCAViewClass;
        }
        throw new TypeError( 'Unknown history_content_type: ' + contentType );
    },

    /** in this override, add a linktarget, and expand if id is in web storage */
    _getItemViewOptions : function( model ){
        var options = _super.prototype._getItemViewOptions.call( this, model );
        return _.extend( options, {
            linkTarget      : this.linkTarget,
            expanded        : this.model.contents.storage.isExpanded( model.id ),
            hasUser         : this.model.ownedByCurrUser()
        });
    },

    /** In this override, add/remove expanded/collapsed model ids to/from web storage */
    _setUpItemViewListeners : function( view ){
        var panel = this;
        _super.prototype._setUpItemViewListeners.call( panel, view );
//TODO: send from content view: this.model.collection.storage.addExpanded
        // maintain a list of items whose bodies are expanded
        return panel.listenTo( view, {
            'expanded': function( v ){
                panel.model.contents.storage.addExpanded( v.model );
            },
            'collapsed': function( v ){
                panel.model.contents.storage.removeExpanded( v.model );
            }
        });
    },

    /** override to remove expandedIds from webstorage */
    collapseAll : function(){
        this.model.contents.storage.clearExpanded();
        _super.prototype.collapseAll.call( this );
    },

// TODO: should we try to make the distinction between new contents and old that haven't been added yet?

    /**  */
    addItemView : function( model, collection, options ){
        console.log( this + '(historyView).addItemView:', model, collection, options );
        var self = this;
        var contents = self.model.contents;
        var lastSection = contents._lastSection();
        var isNotLastSection = contents.currentSection !== lastSection;

        // open and show the most recent section before adding anything there
        if( isNotLastSection ){
            // we need to set this now (instead of after the fetch) so that the
            // if statement above isn't triggered more than once
            self.model.contents.setCurrentSection( lastSection );
            self.model.contents.fetchSection( lastSection, { silent: true })
                .done( function(){
                    self.renderItems();
                    self.addItemView( model, collection, options );
                });
            return;
        }
        self.scrollTo( 0 );

        // console.log( 'contains?', contents.contains( model ) );
        // console.log( 'get:', contents.get( model.id ) + '' );
        // console.log( contents.length );
        // contents.on( 'all', console.info, console );

        // console.log( '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^' );
        var hid = model.get( 'hid' );
        var insertionIndex = contents._indexOfHidInSection( hid, contents.currentSection );
        // console.log( hid, insertionIndex, contents.at( insertionIndex ) + '' );
        // console.log( contents.at( insertionIndex - 1 ) + '', contents.at( insertionIndex + 1 ) + '' );
        if( insertionIndex === null ){ return null; }

//TODO: this should happen elsewhere
        // have to manually update the hid_counter
        self.model.set( 'hid_counter', self.model.get( 'hid_counter' ) + 1 );
        // console.log( 'hid_counter:', self.model.get( 'hid_counter' ) );

        // console.log( 'at index', insertionIndex, 'adding: ' + model );
        var view = self._createItemView( model );
        self.$list().show();
        self.$emptyMessage().fadeOut( self.fxSpeed );
        self._attachView( view, insertionIndex );
        // console.log( '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^' );

        return view;
    },

    /**  */
    _attachView : function( view, modelIndex, useFx ){
        // console.log( '_attachView:', view, modelIndex, useFx );
        useFx = _.isUndefined( useFx )? true : useFx;
        var self = this;
        var $el = self._renderItemView$el( view ).hide();

// Im not sure any of this shit is needed - (it prob. isn't *when adding to the last section*)
        var viewIndex = 0;
        var prevModel = self.model.contents.at( modelIndex - 1 );
        // console.log( 'prevModel: ' + prevModel, prevModel );
        if( prevModel ){
            var found = _.findIndex( self.views, function( v ){
                // console.log( '       ', v + '', v.model + '' );
                // console.log( '       ', v.model === prevModel );
                return v.model === prevModel;
            });
            // console.log( 'found:', found );
            if( found !== -1 ){ viewIndex = found + 1; }
        }
        // var viewIndex = Math.max( 0, _.findIndex( self.views, function( v ){ return v.model === prevModel; }) );
        // console.log( 'viewIndex:', viewIndex );

        self.views.splice( viewIndex, 0, view );
        if( viewIndex === 0 ){
            self.$currentSection().prepend( $el );

        } else {
            var prevView = self.views[ viewIndex ];
            // console.log( 'prevView:', prevView + '', prevView.$el.get(0) );
            // console.log( prevView.$el.parent().get(0) );
            // $el.insertAfter( prevView.$el );
            self.$currentSection().children( '.history-content' ).eq( viewIndex - 1 ).after( $el );
        }
        // console.log( 'self.views[ viewIndex ]:', self.views[ viewIndex ] );
        self.trigger( 'view:attached', view );

        if( useFx ){
            view.$el.slideDown( self.fxSpeed, function(){
                self.trigger( 'view:attached:rendered' );
            });
        } else {
            self.trigger( 'view:attached:rendered' );
        }
        return view;
    },


    // ------------------------------------------------------------------------ selection
    /** Override to correctly set the historyId of the new collection */
    getSelectedModels : function(){
        var collection = _super.prototype.getSelectedModels.call( this );
        collection.historyId = this.collection.historyId;
        return collection;
    },

    /** show the user that the contents are loading/contacting the server */
    showContentsLoadingIndicator : function( speed ){
        speed = _.isNumber( speed )? speed : this.fxSpeed;
        if( this.$emptyMessage().is( ':visible' ) ){
            this.$emptyMessage().hide();
        }
        // look for an existing indicator and stop all animations on it, otherwise make one
        var $indicator = this.$( '.contents-loading-indicator' );
        if( $indicator.size() ){
            return $indicator.stop().clearQueue();
        }

        // move it to the bottom and fade it in
        // $indicator = $( '<div class="contents-loading-indicator">' + _l( 'Loading...' ) + '</div>' ).hide();
        $indicator = $( this.templates.contentsLoadingIndicator( {}, this )).hide();
        return $indicator
            .insertAfter( this.$list() )
            .slideDown( speed );
    },

    /** show the user we're done loading */
    hideContentsLoadingIndicator : function( speed ){
        speed = _.isNumber( speed )? speed : this.fxSpeed;
        this.$( '> .contents-loading-indicator' ).slideUp({ duration: 100, complete: function _complete(){
            $( this ).remove();
        }});
    },

    // ------------------------------------------------------------------------ panel events
    /** event map */
    events : _.extend( _.clone( _super.prototype.events ), {
        // toggle list item selectors
        'click .show-selectors-btn'         : 'toggleSelectors',
        // allow (error) messages to be clicked away
        'click .messages [class$=message]'  : 'clearMessages',
        'click .list-items-section-link'    : '_clickSectionLink',
    }),

    _clickSectionLink : function( ev ){
        var sectionNumber = $( ev.currentTarget ).parent().data( 'section' );
        this.openSection( sectionNumber );
    },

    /** loads a section and re-renders items */
    openSection : function( section, options ){
        options = options || {};
        var self = this;
        var contents = self.model.contents;
        var isLastSection = section === contents._lastSection();
        return contents.fetchSection( section, { silent: true })
            .done( function(){
                contents.setCurrentSection( section );
                self.renderItems();

                var sectionElement = self.$section( section ).get(0);
                var sectionTop = sectionElement.offsetTop;
                var sectionBottom = sectionElement.offsetTop + sectionElement.offsetHeight;
                if( options.startAtBottom ){
                    // place bottom of scroll container at bottom of section
                    self.scrollTo( sectionBottom - self.$scrollContainer().height() );
                } else {
                    self.scrollTo( isLastSection? 0 : sectionElement.offsetTop );
                }
            });
    },

    /** Toggle and store the deleted visibility and re-render items
     * @returns {Boolean} new setting
     */
    toggleShowDeleted : function( show, options ){
        show = ( show !== undefined )?( show ):( !this.model.contents.includeDeleted );
        var self = this;
        var contents = self.model.contents;
        contents.setIncludeDeleted( show, options );
        self.trigger( 'show-deleted', show );

        var fetch = show? contents.fetchDeletedInSection( contents.currentSection ) : jQuery.when();
        fetch.done( function(){ self.renderItems(); });
        return contents.includeDeleted;
    },

    /** Toggle and store whether to render explicity hidden contents
     * @returns {Boolean} new setting
     */
    toggleShowHidden : function( show, store, options ){
        show = ( show !== undefined )?( show ):( !this.model.contents.includeHidden );
        var self = this;
        var contents = self.model.contents;
        contents.setIncludeHidden( show, options );
        self.trigger( 'show-hidden', show );

        var fetch = show? contents.fetchHiddenInSection( contents.currentSection ) : jQuery.when();
        fetch.done( function(){ self.renderItems(); });
        return contents.includeHidden;
    },

    /** On the first search, if there are no details - load them, then search */
    _firstSearch : function( searchFor ){
        var self = this;
        var inputSelector = '> .controls .search-input';
        var initialContentsLength = self.model.contents.length;
        this.log( 'onFirstSearch', searchFor );

        // if the contents already have enough details to search, search and return now
        if( self.model.contents.haveSearchDetails() ){
            self.searchItems( searchFor );
            return;
        }

        // otherwise, load the details progressively here
        self.$( inputSelector ).searchInput( 'toggle-loading' );
        // TODO?: self.$( inputSelector + ' input' ).prop( 'disabled', true ) ?? not disabling could cause trouble here
        self.model.contents.progressivelyFetchDetails({ silent: true })
            .progress( function( response, limit, offset ){
                // if we're still only merging new attrs to what the contents already have,
                // just render what's there again
                if( offset + response.length <= initialContentsLength ){
                    self.renderItems();
                // if we're adding new items, then listen for sync'ing and bulk add those views
                } else {
                    self.listenToOnce( self.model.contents, 'sync', self.bulkAppendItemViews );
                }
            })
            .always( function(){
                self.$el.find( inputSelector ).searchInput( 'toggle-loading' );
            })
            .done( function(){
                self.searchItems( self.searchFor );
            });
    },

    // ........................................................................ error handling
    /** Event handler for errors (from the panel, the history, or the history's contents)
     *  Alternately use two strings for model and xhr to use custom message and title (respectively)
     *  @param {Model or View} model    the (Backbone) source of the error
     *  @param {XMLHTTPRequest} xhr     any ajax obj. assoc. with the error
     *  @param {Object} options         the options map commonly used with bbone ajax
     */
    errorHandler : function( model, xhr, options ){
        //TODO: to mixin or base model
        // interrupted ajax or no connection
        if( xhr && xhr.status === 0 && xhr.readyState === 0 ){
            // return ERROR_MODAL.offlineErrorModal();
            // fail silently
            return;
        }
        // otherwise, leave something to report in the console
        this.error( model, xhr, options );
        // and feedback to a modal
        // if sent two strings (and possibly details as 'options'), use those as message and title
        if( _.isString( model ) && _.isString( xhr ) ){
            var message = model;
            var title = xhr;
            return ERROR_MODAL.errorModal( message, title, options );
        }
        // bad gateway
        // TODO: possibly to global handler
        if( xhr && xhr.status === 502 ){
            return ERROR_MODAL.badGatewayErrorModal();
        }
        return ERROR_MODAL.ajaxErrorModal( model, xhr, options );
    },

    /** Remove all messages from the panel. */
    clearMessages : function( ev ){
        var $target = !_.isUndefined( ev )?
            $( ev.currentTarget )
            :this.$messages().children( '[class$="message"]' );
        $target.fadeOut( this.fxSpeed, function(){
            $( this ).remove();
        });
        return this;
    },

    // ........................................................................ scrolling
    /** Scrolls the panel to show the content sub-view with the given hid.
     *  @param {Integer} hid    the hid of item to scroll into view
     *  @returns {HistoryView} the panel
     */
    scrollToHid : function( hid ){
        return this.scrollToItem( _.first( this.viewsWhereModel({ hid: hid }) ) );
    },

    // ........................................................................ misc
    /** Return a string rep of the history */
    toString : function(){
        return 'HistoryView(' + (( this.model )?( this.model.get( 'name' )):( '' )) + ')';
    }
});


//------------------------------------------------------------------------------ TEMPLATES
HistoryView.prototype.templates = (function(){

    var mainTemplate = BASE_MVC.wrapTemplate([
        // temp container
        '<div>',
            '<div class="controls"></div>',
            '<ul class="list-items"></ul>',
            '<div class="empty-message infomessagesmall"></div>',
        '</div>'
    ]);

    var controlsTemplate = BASE_MVC.wrapTemplate([
        '<div class="controls">',
            '<div class="title">',
                '<div class="name"><%- history.name %></div>',
            '</div>',
            '<div class="subtitle"></div>',
            '<div class="history-size"><%- history.nice_size %></div>',

            '<div class="actions"></div>',

            '<% if( history.deleted && history.purged ){ %>',
                '<div class="deleted-msg warningmessagesmall">',
                    _l( 'This history has been purged and deleted' ),
                '</div>',
            '<% } else if( history.deleted ){ %>',
                '<div class="deleted-msg warningmessagesmall">',
                    _l( 'This history has been deleted' ),
                '</div>',
            '<% } else if( history.purged ){ %>',
                '<div class="deleted-msg warningmessagesmall">',
                    _l( 'This history has been purged' ),
                '</div>',
            '<% } %>',

            '<div class="messages">',
                '<% if( history.message ){ %>',
                    // should already be localized
                    '<div class="<%= history.message.level || "info" %>messagesmall">',
                        '<%= history.message.text %>',
                    '</div>',
                '<% } %>',
            '</div>',

            // add tags and annotations
            '<div class="tags-display"></div>',
            '<div class="annotation-display"></div>',

            '<div class="search">',
                '<div class="search-input"></div>',
            '</div>',

            '<div class="list-actions">',
                '<div class="btn-group">',
                    '<button class="select-all btn btn-default"',
                            'data-mode="select">', _l( 'All' ), '</button>',
                    '<button class="deselect-all btn btn-default"',
                            'data-mode="select">', _l( 'None' ), '</button>',
                '</div>',
                '<div class="list-action-menu btn-group">',
                '</div>',
            '</div>',
        '</div>'
    ], 'history' );

    var contentsLoadingIndicatorTemplate = BASE_MVC.wrapTemplate([
        '<div class="contents-loading-indicator">',
            '<span class="fa fa-2x fa-spin fa-spinner">',
        '</span></div>'
    ], 'history' );

    var paginationTemplate = BASE_MVC.wrapTemplate([
        '<button class="prev">previous</button>',
        '<% function getHid( content ){ return content? content.get( "hid" ) : "?"; } %>',
        '<button class="pages">',
            '<%- getHid( view.model.contents.last() ) %> to <%- getHid( view.model.contents.first() ) %>',
        '</button>',
        '<button class="next">next</button>',
    ], 'history' );

    var listItemsSectionTemplate = BASE_MVC.wrapTemplate([
        '<% var currClass = section.number === view.model.contents.currentSection? " current-section" : ""; %>',
        '<li class="list-items-section<%- currClass %>" data-section="<%- section.number %>">',
            '<% if( view.model.contents._countSections() > 2 ){ %>',
                '<a class="list-items-section-link" href="javascript:void(0)">',
                    '<%- section.first %>  ', _l( "to" ), ' <%- section.last %>',
                '</a>',
            '<% } %>',
        '</li>',
    ], 'section' );

    return _.extend( _.clone( _super.prototype.templates ), {
        el                      : mainTemplate,
        controls                : controlsTemplate,
        contentsLoadingIndicator: contentsLoadingIndicatorTemplate,
        pagination              : paginationTemplate,
        listItemsSection        : listItemsSectionTemplate
    });
}());


//==============================================================================
    return {
        HistoryView: HistoryView
    };
});
