define([
	"react",
	"jsx!./shortcut",
	"./key-constants",
	"lib/handle-ref"
], function(
	React,
	Shortcut,
	KeyConstants,
	handleRef
) {
	const FunctionKeyPattern = /^F\d{1,2}$/i;
	const ShiftedKeyAliases = {
		106: "*",	// numpad
		107: "+",	// numpad
		109: "-",	// numpad
		110: ".",	// numpad
		111: "/",	// numpad
		186: ";",
		187: "=",
		188: ",",
		189: "-",
		190: ".",
		191: "/",
		192: "`",
		219: "[",
		220: "\\",
		221: "]",
		222: "'"
	};
	const KeyCodes = "AZ09".split("").reduce(function(result, char) {
		result[char] = char.charCodeAt(0);

		return result;
	}, {});
	const KeyOrder = KeyConstants.KeyOrder;
	const ModifierAliases = KeyConstants.ModifierAliases;
	const ShortcutSeparator = KeyConstants.ShortcutSeparator;


	const ShortcutPicker = React.createClass({
		lastKeyDown: "",


		getDefaultProps: function()
		{
			return {
				placeholder: "Type a shortcut",
				validate: function(
					key,
					modifiers,
					baseKey,
					shortcut)
				{
					return {
						isKeyAllowed: true,
						isShortcutValid: !!baseKey
					};
				}
			};
		},


		getInitialState: function()
		{
			return {
				focused: false,
				arePressedKeysValid: false,
				pressedKeys: [],
				errorKey: "",
				errorMessage: ""
			};
		},


		componentWillReceiveProps: function(
			nextProps)
		{
				// when getting new props, such as when the shortcuts have been
				// reset to the defaults, we have to clear the pressed keys, in
				// case they were a valid shortcut.  otherwise, the picker won't
				// update with the new shortcut.
			this.setState({
				arePressedKeysValid: false,
				pressedKeys: []
			});
		},


		handleDisplayRef: handleRef("display"),


		getKeysFromShortcut: function(
			shortcut)
		{
			const keys = [];

			shortcut.split(ShortcutSeparator).forEach(function(key) {
				const order = KeyOrder[key];

				keys[isNaN(order) ? KeyOrder.char : order] = ModifierAliases[key] || key;
			});

			return keys;
		},


		getShortcutFromKeys: function(
			keys)
		{
				// filter out any empty items in the pressed keys array
			return keys.filter(function(key) { return key; })
				.join(ShortcutSeparator);
		},


		getKeyString: function(
			event)
		{
			const keyCode = event.keyCode;
			const key = FunctionKeyPattern.test(event.key) ? event.key : event.key.toLowerCase();

			if ((keyCode >= KeyCodes.A && keyCode <= KeyCodes.Z) ||
					(keyCode >= KeyCodes["0"] && keyCode <= KeyCodes["9"])) {
				return String.fromCharCode(keyCode);
			} else {
				return ShiftedKeyAliases[keyCode] || ModifierAliases[key] || key;
			}
		},


		getKeyOrder: function(
			key)
		{
			const order = KeyOrder[key];

// TODO: rationalize the handling of tab, enter, etc. so this isn't necessary.  getKeyOrder() is only called from handleKeyDown
			if (order > KeyOrder.char) {
				return -1;
			} else if (isNaN(order)) {
				return KeyOrder.char;
			} else {
				return order;
			}
		},


		isValidKey: function(
			key)
		{
			return key.length == 1 || KeyOrder[key] > -1 ||
				FunctionKeyPattern.test(key);
		},


		validateShortcut: function(
			key,
			pressedKeys)
		{
				// filter any undefineds from the modifiers array
			const modifiers = pressedKeys.slice(0, KeyOrder.char).filter(function(key) { return key });
			const baseKey = pressedKeys[KeyOrder.char];
			const shortcut = this.getShortcutFromKeys(pressedKeys);

			return this.props.validate(key, modifiers, baseKey, shortcut);
		},


		handleFocus: function(
			event)
		{
			this.setState({
				focused: true,
				arePressedKeysValid: false,
				pressedKeys: []
			});
		},


		handleBlur: function(
			event)
		{
				// we need to use an updater function because if we were just
				// blurred by handleKeyDown(), then the arePressedKeysValid
				// state may not have been updated yet.  clear any error
				// message, since keys are no longer being pressed.
			this.setState(state => ({
				errorKey: "",
				errorMessage: "",
				focused: false,
				pressedKeys: state.arePressedKeysValid ? state. pressedKeys : []
			}));
			this.lastKeyDown = "";
		},


		handleKeyDown: function(
			event)
		{
			const props = this.props;
			const key = this.getKeyString(event);
			const order = this.getKeyOrder(key);
				// we have to make a copy of the array to not affect the state,
				// since even if we don't include the pressedKeys attribute in
				// the setState() call, the change is there when accessed via
				// this.state.pressedKeys
			const pressedKeys = [].concat(this.state.pressedKeys);

				// track the last key down so that we're not constantly setting
				// the state while the user holds down the key and it repeats
			if (key == "escape") {
				this.display.blur();
			} else if (this.lastKeyDown !== key) {
				this.lastKeyDown = key;

				if (order > -1 && this.isValidKey(key)) {
					pressedKeys[order] = key;
					event.preventDefault();

					const validation = this.validateShortcut(key, pressedKeys);

					if (validation.isKeyAllowed) {
						this.setState({
							arePressedKeysValid: validation.isShortcutValid,
							pressedKeys: pressedKeys
						});
					}

					if (validation.isShortcutValid) {
							// tell our parent the shortcut has changed and then
							// blur the picker, which will clear any error message
						props.onChange(this.getShortcutFromKeys(pressedKeys), props.id);
						this.display.blur();
					} else {
						this.setState({
							errorKey: key,
							errorMessage: validation.errorMessage
						});
					}
				}
			}
		},


		handleKeyUp: function(
			event)
		{
			const key = this.getKeyString(event);
			const keyIndex = this.state.pressedKeys.indexOf(key);

			if (keyIndex > -1) {
				const pressedKeys = [].concat(this.state.pressedKeys);

				pressedKeys[keyIndex] = undefined;

				this.setState({
					pressedKeys: pressedKeys
				});
				event.preventDefault();
			}

			if (this.state.errorKey == key) {
				this.setState({
					errorKey: "",
					errorMessage: ""
				});
			}

			this.lastKeyDown = "";
		},


		handleClearMouseDown: function(
			event)
		{
				// don't focus when the clear button is clicked
			event.preventDefault();
		},


		handleClearClick: function(
			event)
		{
			this.props.onChange("", this.props.id);

				// in case another picker is focused when the user clicks the
				// clear button, blur that picker
			document.activeElement && document.activeElement.blur();
		},


		render: function()
		{
			const {focused, errorMessage, pressedKeys, arePressedKeysValid} = this.state;
			const {disabled, id, placeholder} = this.props;
				// specifying a default value, like shortcut = "", breaks the
				// JSX Transformer, so leave this for now
			const shortcut = this.props.shortcut || "";
			const tabIndex = disabled ? -1 : 0;
			const className = "shortcut-picker " + (disabled ? "disabled" : "");
			const keys = (focused || arePressedKeysValid) ?
				pressedKeys : this.getKeysFromShortcut(shortcut);

			return <div className={className}>
				<div id={id}
					className="shortcut-display"
					ref={this.handleDisplayRef}
					tabIndex={tabIndex}
					onFocus={!disabled && this.handleFocus}
					onBlur={!disabled && this.handleBlur}
					onKeyDown={!disabled && this.handleKeyDown}
					onKeyUp={!disabled && this.handleKeyUp}
				>
					<Shortcut keys={keys} />
					{
						!disabled && !focused && shortcut &&
						<div className="clear-button"
							title="Remove the shortcut"
							onMouseDown={this.handleClearMouseDown}
							onClick={this.handleClearClick}
						/>
					}
					{
						focused && !pressedKeys.join("") &&
						<div className="placeholder">{placeholder}</div>
					}
				</div>
				{
					errorMessage && <div className="error">{errorMessage}</div>
				}
			</div>
		}
	});


	return ShortcutPicker;
});
