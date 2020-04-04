// polymer
import { PolymerElement } from '@polymer/polymer/polymer-element.js';

// ui-platform-elements
import { MixinManager } from "../../../../node_modules/ui-platform-elements/lib/managers/mixin-manager.js";
import { PluginFunctionBase } from "../../../../node_modules/ui-platform-elements/lib/base/plugin-function-base.js";


class SendMailPluginFunction extends MixinManager(PolymerElement).with(PluginFunctionBase) {
    
    connectedCallback() {
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }
    
    init() {
        var actions = {
            "context-loaded": {
                "name": "context-loaded"
            },
            "send-mail-action": {
                "name": "send-mail-action"
            }
        };
        this.aci.registerRuntimeAction(actions, this);
    }

    actionCallback(actionName, data) {
        switch (actionName) {
            case "context-loaded":
                alert("Context loaded action received in send-mail plugin function");
                break;

            case "send-mail-action":
                alert("Send mail action received in send-mail plugin function");
                break;

            default:
                break;
        }
    }

};

customElements.define("send-mail-plugin-function", SendMailPluginFunction);