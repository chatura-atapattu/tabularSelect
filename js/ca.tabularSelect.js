/*
 * jQuery UI ca.tabularSelect, a multiple select plugin in tabular form
 * by Chatura Atapattu for Evidon, http://www.evidon.com
 * 
 * Version 0.1
 * MIT License
 * 
 * This plugin was created to improve upon the already existing ui.multiselect 
 * plugin written by Michael Aufreiter and Yanick Rochon 
 * (http://www.quasipartikel.at/multiselect/), attemping to improve overall speed
 * and memory usage.  Some ideas and techniques have also been drawn from Chosen,
 * by Patrick Filler (https://github.com/harvesthq/chosen)
 * 
 * TODO: performance improvements, abstracting our drawing and sizing, CSS
 * 
 */
(function ($) {
	$.widget('ca.tabularSelect', {
		/* These options will be used as defaults */
		options: {
			className: 'tabularSelect',
			draggable: true,
			sortable: true,
			searchable: true,
			addAll: true,
			removeAll: true,
			maxSelect: -1, // -1 = unlimited
			alternating: true,
			doubleClickable: true,
			selectOrder: 'left-to-right',
			animated: 'fast',
			show: 'slideDown',
			hide: 'slideUp',
			dividerLocation: 0.5
		},

		_create: function () {
			if (typeof this.element.attr('multiple') === 'undefined') {
				return false;
			}
			this.element.hide();
			this.id = this.element.attr("id") + '-tabularSelect';
			this.container = $('<div id="' + this.id + '" class="ca-tabularSelect ui-helper-clearfix ui-widget" />').insertAfter(this.element);
			if (this.options.selectOrder == 'right-to-left') {
				this.selectedContainer = $('<div class="selected" />').appendTo(this.container);
				$('<div class="divider" />').appendTo(this.container);
				this.availableContainer = $('<div class="available" />').appendTo(this.container);
			} else {
				this.availableContainer = $('<div class="available" />').appendTo(this.container);
				$('<div class="divider" />').appendTo(this.container);
				this.selectedContainer = $('<div class="selected" />').appendTo(this.container);
			}
			this.selectedActions = $('<div class="actions ui-widget-header ui-helper-clearfix"><span class="count">0 ' + $.ca.tabularSelect.locale.itemsCount + '</span><a href="#" class="remove-all">' + $.ca.tabularSelect.locale.removeAll + '</a></div>').appendTo(this.selectedContainer);
			this.availableActions = $('<div class="actions actions-available ui-widget-header ui-helper-clearfix"><input type="text" class="search empty ui-widget-content ui-corner-all" value="' + $.ca.tabularSelect.locale.searchText + '" /><a href="#" class="add-all">' + $.ca.tabularSelect.locale.addAll + '</a></div>').appendTo(this.availableContainer);
			this.availableList = $('<ul class="available connected-list" />').appendTo(this.availableContainer);
			this.availableList.append($('<li class="ui-helper-hidden-accessible" />'));
			this.availableList.bind('selectstart', function (e) {
				e.preventDefault();
			});
			this.selectedList = $('<ul class="selected connected-list" />').appendTo(this.selectedContainer);
			this.selectedList.append($('<li class="ui-helper-hidden-accessible" />'));
			this.selectedList.bind('selectstart', function (e) {
				e.preventDefault();
			});
			
			/* Set container dimensions */
			this.container.width(this.element.width() + 1);
			if (this.options.selectedOrder == 'right') {
				this.availableContainer.width(Math.floor(this.element.width() * this.options.dividerLocation));
				this.selectedContainer.width(Math.floor(this.element.width() * (1 - this.options.dividerLocation)));
			} else {
				this.selectedContainer.width(Math.floor(this.element.width() * this.options.dividerLocation));
				this.availableContainer.width(Math.floor(this.element.width() * (1 - this.options.dividerLocation)));
			}
			
			/* fix list height to match container depending on their individual header's heights */
			this.selectedList.height(Math.max(this.element.height() - this.selectedActions.height(), 1));
			this.container.children('.divider').height(this.container.height());
			this.availableList.height(Math.max(this.element.height() - this.availableActions.height(), 1));
			if (!this.options.animated) {
				this.options.show = 'show';
				this.options.hide = 'hide';
			}
			
			var that = this;
			
			if (this.options.draggable) {
				this.selectedList.droppable({
					drop: function (event, ui) {
						that._addOption(ui.draggable, false);
					}
				});
			}
			
			if (this.options.sortable) {
				this.selectedList.sortable({
					placeholder: 'ui-state-highlight',
					axis: 'y',
					update: function (event, ui) {
						that._setAlternating(that.selectedList);
					}
				});
			}
			
			/* Add/remove config */
			if (this.options.addAll) {
				this.availableActions.find('input.search').width(this.availableActions.innerWidth() - this.availableActions.find('a.add-all').outerWidth() - 15);
			} else {
				this.availableActions.find('a.add-all').remove();
			}
			if (!this.options.removeAll) {
				this.selectedActions.find('a.remove-all').remove();
			}
			
			/* Set up livesearch */
			if (this.options.searchable) {
				/* Set search to clear upon focus/blur */
				var search = this.availableContainer.find('input.search');
				$(search).focus(function () {
					if (this.value == this.defaultValue) {
						this.value = '';
					}
				});
				$(search).blur(function () {
					if (this.value == '') {
						this.value = this.defaultValue;
					}
				});
				/* Register livesearch */
				this._registerSearchEvents(search);
			} else {
				this.availableActions.find('input.search').remove();
			}
			
			/* Batch actions */
			this.selectedActions.find("a.remove-all").click(function (e) {
				e.preventDefault();
				that.selectedList.children('.ui-element').each(function (index, option) {
					that._removeOption($(option), true);
				});
				that._updateCount();
				that._setAlternating(that.availableList);
			});
			this.availableActions.find("a.add-all").click(function (e) {
				e.preventDefault();
				/* If 90% of options need to be added, reinitialize with selected options */
				if (that._data.count > (0.9 * that._data.options.length)) {
					that.availableList.children('.ui-element').not('.ca-tabularSelect-available-selected').each(function (index, option) {
						that._addOption($(option), true);
					});
					that._updateCount();
					that._setAlternating(that.selectedList);
				} else {
					var options = that.element.children('option').not(":selected").prop('selected', true);
					that._init();
				}
			});
			
			if (jQuery.isFunction(this.options.customOption)) {
				this._optionContainer = this.options.customOption;
			}
		},

		_init: function () {
			this._data = {
				count: 0,
				options: []
			};
			this._parseOptions();
			this._setState(this.availableList.children('li'), false);
			this._registerAddEvents(this.availableList.children('li'));
			this._setState(this.selectedList.children('li'), true);
			this._registerRemoveEvents(this.selectedList.children('li'));
			this._registerDoubleClickEvents(this.availableList.children('li'));
			this._registerHoverEvents(this.container.find('li'));
			this._updateCount();
			this._setAlternating();
		},

		_parseOptions: function () {
			var that = this;
			var options = this.element.children('option');
			options.each(function (index, option) {
				if (option.text !== "") {
					that._data.options.push({
						array_index: index,
						options_index: index,
						value: option.value,
						text: option.text,
						html: option.innerHTML,
						selected: option.selected,
						disabled: option.disabled,
						classes: option.className,
						style: option.style.cssText
					});
				} else {
					that._data.options.push({
						array_index: index,
						options_index: index,
						empty: true
					});
				}
			});
			this._data.availableListHTML = '';
			this._data.selectedListHTML = '';
			$.each(this._data.options, function (index, option) {
				that._populateOption(index, option);
			});
			this.availableList.html(this._data.availableListHTML);
			this.selectedList.html(this._data.selectedListHTML);
			
			/* Hide selected items in available list */
			this.selectedList.children('.ui-element').each(function (index, option) {
				var availableItem = that.availableList.children('#' + $(option).attr('id'));
				availableItem.hide();
				availableItem.addClass('ca-tabularSelect-available-selected');
			});
		},

		_optionContainer: function (option) {
			return option.html;
		},

		_renderOption: function (option) {
			var classes, style;
			classes = ['ui-state-default', 'ui-element'];
			if (option.classes !== "") {
				classes.push(option.classes);
			}
			style = option.style.cssText !== "" ? " style=\"" + option.style + "\"" : "";
			var optionHTML = '<li id="' + option.dom_id + '" class="' + classes.join(' ') + '" title="' + option.html + '" ' + style + '>';
			optionHTML += this._optionContainer(option);
			optionHTML += '<a href="#" class="action"><span class="ui-corner-all ui-icon"/></a></li>';
			return optionHTML;
		},

		_populateOption: function (index, option) {
			if (!option.disabled) {
				option.dom_id = this.id + "_o_" + index;
				var html = this._renderOption(option);
				this._data.availableListHTML += html;
				if (option.selected) {
					this._data.selectedListHTML += html;
					this._data.count++;
				}
			}
		},

		_setSelected: function (option, isSelected) {
			var optionId = option.attr('id');
			var index = optionId.substr(optionId.lastIndexOf("_") + 1);
			var optionData = this._data.options[index];
			optionData.selected = isSelected;
			$(this.element.get(0).options[optionData.options_index]).prop('selected', isSelected);
			if (isSelected == true) {
				this._data.count++;
			} else {
				this._data.count--;
			}
			return index;
		},

		_setState: function (elements, isSelected) {
			if (isSelected) {
				if (this.options.sortable) {
					elements.children('span').addClass('ui-icon-arrowthick-2-n-s').removeClass('ui-helper-hidden').addClass('ui-icon');
				} else {
					elements.children('span').removeClass('ui-icon-arrowthick-2-n-s').addClass('ui-helper-hidden').removeClass('ui-icon');
				}
				elements.find('a.action span').addClass('ui-icon-minus').removeClass('ui-icon-plus');
			} else {
				elements.children('span').removeClass('ui-icon-arrowthick-2-n-s').addClass('ui-helper-hidden').removeClass('ui-icon');
				elements.find('a.action span').addClass('ui-icon-plus').removeClass('ui-icon-minus');
			}
		},

		_addOption: function (option, isBulk) {
			if (option.hasClass('ca-tabularSelect-available-selected')) {
				return false;
			}
			var that = this;
			if (this.options.maxSelect != -1 && this._data.count >= this.options.maxSelect) {
				alert($.ca.tabularSelect.locale.maxMessage);
				return false;
			}
			var index = this._setSelected(option, true);
			var selectedOption = $(this._renderOption(this._data.options[index]));
			this._setState(selectedOption, true);
			this._registerRemoveEvents(selectedOption);
			this._registerDoubleClickEvents(selectedOption);
			this._registerHoverEvents(selectedOption);
			option.addClass('ca-tabularSelect-available-selected');
			if (isBulk) {
				this.selectedList.append(selectedOption);
				option.hide();
			} else {
				selectedOption.hide();
				this.selectedList.append(selectedOption);
				selectedOption[this.options.show](
					this.options.animated, 
					'linear',
					function() {
						that._setAlternating(that.selectedList);
					}
				);
				option[this.options.hide](
					this.options.animated,
					'linear',
					function() {
						$(this).hide();
						that._setAlternating(that.availableList);
					}
				);
			}
			return true;
		},

		_removeOption: function (option, isBulk) {
			var that = this;
			var availableOption = this.availableList.children('#' + option.attr('id'));
			this._setSelected(option, false);
			availableOption.removeClass('ca-tabularSelect-available-selected');
			if (isBulk) {
				availableOption.show();
				option.remove();
			} else {
				availableOption[this.options.show](
					this.options.animated, 
					'linear',
					function() {
						that._setAlternating(that.availableList);
					}
				);
				option[this.options.hide](
					this.options.animated, 
					'linear',
					function() {
						$(this).remove();
						that._setAlternating(that.selectedList);
					}
				);
			}
			return true;
		},

		_updateCount: function () {
			this.selectedContainer.find('span.count').text(this._data.count + " " + $.ca.tabularSelect.locale.itemsCount);
		},

		/* taken from John Resig's liveUpdate script */
		_filter: function (list) {
			if (this.value != this.defaultValue) {
				var input = $(this);
				var rows = list.children('li'),
					cache = rows.map(function () {
						return $(this).text().toLowerCase();
					});
				var term = $.trim(input.val().toLowerCase()),
					scores = [];
				if (!term) {
					rows.not('.ca-tabularSelect-available-selected').show();
				} else {
					rows.hide();
					cache.each(function (i) {
						if (this.indexOf(term) > -1) {
							scores.push(i);
						}
					});
					$.each(scores, function () {
						$(rows[this]).not('.ca-tabularSelect-available-selected').show();
					});
				}
			}
		},

		_addEvent: function (option) {
			if (this._trigger('beforeAdd', null, option) === false) {
				return;
			}
			if (this._addOption($(option), false) === false) {
				return;
			}
			this._updateCount();
			this._trigger('afterAdd', null, option);
		},

		_removeEvent: function (option) {
			if (this._trigger('beforeRemove', null, option) === false) {
				return;
			}
			if (this._removeOption(option, false) === false) {
				return;
			}
			this._updateCount();
			this._trigger('afterRemove', null, option);
		},

		_registerAddEvents: function (elements) {
			var that = this;
			elements.data('isHandlerActive', false);
			$(elements.children('a.action')).click(function (e) {
				e.preventDefault();
				that._addEvent($(this).parent());
			});
			/* make draggable */
			if (this.options.draggable) {
				$(elements).draggable({
					helper: function () {
						var selectedItem = $(this).clone();
						selectedItem.attr('id', $(this).attr('id'));
						selectedItem.width($(this).width());
						return selectedItem;
					},

					appendTo: that.container,
					containment: that.container,
					revert: 'invalid'
				});
			}
		},

		_registerRemoveEvents: function (elements) {
			var that = this;
			$(elements.children('a.action')).click(function (e) {
				e.preventDefault();
				that._removeEvent($(this).parent());
			});
		},

		_registerDoubleClickEvents: function (elements) {
			var that = this;
			if (this.options.doubleClickable) {
				elements.dblclick(function (e) {
					e.preventDefault();
					$(this).find('a.action').click();
				});
			}
		},

		_registerHoverEvents: function (elements) {
			elements.removeClass('ui-state-hover');
			elements.mouseover(function () {
				$(this).addClass('ui-state-hover');
			});
			elements.mouseout(function () {
				$(this).removeClass('ui-state-hover');
			});
		},

		_registerSearchEvents: function (input) {
			var that = this;
			input.focus(function () {
				$(this).addClass('ui-state-active');
			}).blur(function () {
				$(this).removeClass('ui-state-active');
			}).keypress(function (e) {
				if (e.keyCode == 13) return false;
			}).keyup(function () {
				that._filter.apply(this, [that.availableList]);
				that._setAlternating(that.availableList);
			});
		},

		_setAlternating: function (list) {
			if (this.options.alternating) {
				if (typeof list === "undefined") {
					this.availableList.children('.ui-element').removeClass('alt-row').filter(':visible:odd').addClass('alt-row');
					this.selectedList.children('.ui-element').removeClass('alt-row').filter(':visible:odd').addClass('alt-row');
				} else {
					list.children('.ui-element').removeClass('alt-row').filter(':visible:odd').addClass('alt-row');
				}
			}
		},

		_setOption: function (key, value) {
			$.Widget.prototype._setOption.call(this, key, value);
		},

		refresh: function() {
			this.init();
		},
		
		destroy: function () {
			this.element.show();
			this.container.remove();
			$.Widget.prototype.destroy.call(this);
		}
	});
})(jQuery);

$.extend($.ca.tabularSelect, {
	locale: {
		addAll: 'Add all',
		removeAll: 'Remove all',
		itemsCount: 'items selected',
		maxMessage: 'The maximum number of items have been selected. Skipping any further items.',
		searchText: 'Search...'
	}
});
