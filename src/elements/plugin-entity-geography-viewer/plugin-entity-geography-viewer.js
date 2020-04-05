import { PolymerElement, html } from '@polymer/polymer/polymer-element.js';
import '@google-web-components/google-chart/google-chart.js';

// ui-platform-utils
import { ObjectUtils } from 'ui-platform-utils/lib/common/ObjectUtils.js';
import { ContextUtils } from 'ui-platform-utils/lib/mdm/ContextUtils.js';

//ui-platform-elements
import 'ui-platform-elements/lib/styles/bedrock-style-common.js';
import 'ui-platform-elements/lib/elements/pebble-spinner/pebble-spinner.js';
import { AppInstanceManager } from 'ui-platform-elements/lib/managers/app-instance-manager.js';

// ui-platform-dataaccess
import { DataAccessManager } from 'ui-platform-dataaccess/lib/index.js';

class PluginEntityGeographyViewer extends PolymerElement {
    static get is() {
        return 'plugin-entity-geography-viewer';
    }

    static get template() {
        return html`
            <style include="bedrock-style-common">
                .chart-div {
                    padding-top: 20px;
                }
                google-chart {
                    width: 90%;
                    height: 90%;
                }
                #label {
                    font-size: 18px;
                }
            </style>
            <pebble-spinner active="[[_loading]]"></pebble-spinner>
            <div id="label">Entity Geography</div>
            <template is="dom-if" if="[[_loadGeoChart]]">
                <div id="geoChart" class="chart-div">
                    <google-chart
                        type='geo'
                        options="[[options]]"
                        data="[[_countriesData]]">
                    </google-chart>
                </div>
            </template>
            <div id="message" class="default-message" hidden$="[[_loadGeoChart]]">[[_message]]</div>
        `;
    }

    static get properties() {
        return {
            _loading: {
                type: Boolean,
                value: false
            },
            _loadGeoChart: {
                type: Boolean,
                value: false
            },
            _countriesData: {
                type: Array,
                value: function () {
                    return [];
                }
            },
            _message: {
                type: String,
                value: ""
            },
            options: {
                type: Object,
                value: function () {
                    return {
                        defaultColor: "#026bc3"
                    }
                }
            },
            _countries: {
                type: Array,
                value: function () {
                    return [];
                }
            },
            countryEntityType: {
                type: String,
                value: ""
            },
            isoCountryNameAttribute: {
                type: String,
                value: ""
            }
        }
    }

    connectedCallback() {
        super.connectedCallback();
        this._loading = true;
        this._message = "";
        this._loadGeoChart = false;
        this._getContexts();
    }

    async _getContexts() {
        if(ObjectUtils.isEmpty(this.countryEntityType)) {
            this._message = "Country entity type is not available to show entity geography";
            return;
        }
        let currentActiveApp = AppInstanceManager.getCurrentActiveApp();
        let contextData = {};
        if(currentActiveApp) {
            contextData = currentActiveApp.contextData;
        }

        if(ObjectUtils.isValidObjectPath(contextData, "ItemContexts.0.id") && ObjectUtils.isValidObjectPath(contextData, "ItemContexts.0.type")) {
            let itemContext = ContextUtils.getFirstItemContext(contextData);
            let _entityContextRequest = {
                "params": {
                    "query": {
                        "id": itemContext.id,
                        "filters": {
                            "typesCriterion": [
                                itemContext.type
                            ]
                        }
                    }
                }
            };

            let entityContextsResponse = await DataAccessManager.rest("/data/pass-through/entityservice/getcontext", _entityContextRequest);
            this._handleEntityContextsResponse(entityContextsResponse);
        } else {
            this.set("_loadGeoChart", false);
            this._loading = false;
            this._message = "Entity details not available to load geography chart";
        }
    }

    _handleEntityContextsResponse(entityContextsResponse) {
        if (ObjectUtils.isValidObjectPath(entityContextsResponse, "response.entities.0")) {
            let countries = [];
            let entity = entityContextsResponse.response.entities[0];

            if (entity && entity.data && entity.data.contexts) {
                entity.data.contexts.forEach(function (ctx) {
                    if(ctx.context && ctx.context[this.countryEntityType]) {
                        countries.push(ctx.context[this.countryEntityType]);
                    }
                }, this);
            }

            if(!ObjectUtils.isEmpty(countries)) {
                if(ObjectUtils.isEmpty(this.isoCountryNameAttribute)) {
                    let countriesData = [["Country"]];
                    countries.forEach((country) => countriesData.push([country]));
                    this.set("_countriesData", countriesData);
                    this._loading = false;
                    this.set("_loadGeoChart", true);
                } else {
                    this.set("_countries", countries);
                    this._getContextManageModel();
                }
            } else {
                this.set("_loadGeoChart", false);
                this._loading = false;
                this._message = "Entity does not have any country contexts";
            }
        } else {
            this.set("_loadGeoChart", false);
            this._loading = false;
            this._message = "Entity does not have any country contexts";
        }
    }

    async _getContextManageModel() {
        let req = {
            "params": {
                "query": {
                    "id": this.countryEntityType + "_entityManageModel",
                    "filters": {
                        "typesCriterion": [
                            "entityManageModel"
                        ]
                    }
                },
                "fields": {
                    "attributes": ["_ALL"]
                }
            }
        };

        let entityModelGetRequest = DataAccessManager.createRequest("getbyids", req, undefined, { "dataIndex": "entityModel" });
        let entityManageModelResponse = await DataAccessManager.initiateRequest(entityModelGetRequest);
        this._hanldeEntityManageModelResponse(entityManageModelResponse);
    }

    _hanldeEntityManageModelResponse(entityManageModelResponse) {
        if(ObjectUtils.isValidObjectPath(entityManageModelResponse, "response.content.entityModels.0.data.attributes")) {
            let manageModel = entityManageModelResponse.response.content.entityModels[0];
            let attributes = manageModel.data.attributes;
            let externalNameAttribute = "";
            if(!ObjectUtils.isEmpty(attributes)) {
                externalNameAttribute = Object.keys(attributes).find((key) => {
                    if(attributes[key].properties && attributes[key].properties.isExternalName) {
                        return true;
                    }
                });
            }

            this._getContextEntities(externalNameAttribute);
        } else {
            this._loading = false;
            this.set("_loadGeoChart", false);
            this._message = "Cannot fetch codes for the countries entity is part of";
        }
    }

    async _getContextEntities(externalNameAttribute) {
        let req = {
            "params": {
                "query": {
                    "valueContexts": [
                        {
                            "source": "internal",
                            "locale": "en-US"
                        }
                    ],
                    "filters": {
                        "typesCriterion": [
                            this.countryEntityType
                        ],
                    }
                },
                "fields": {
                    "attributes": [this.isoCountryNameAttribute, externalNameAttribute]
                }
            }
        };

        let attributesCriterion = {};
        attributesCriterion[externalNameAttribute] = {
            "exacts": this._countries,
            "type": "_STRING"
        };
        req.params.query.filters["attributesCriterion"] = [attributesCriterion];
        let contextEntitiesGetRequest = DataAccessManager.createRequest("searchandget", req, undefined, { "dataIndex": "entityData" });
        let contextEntitiesGetResponse = await DataAccessManager.initiateRequest(contextEntitiesGetRequest);
        this._handleContextEntitiesResponse(contextEntitiesGetResponse, externalNameAttribute);
    }

    _handleContextEntitiesResponse(contextEntitiesGetResponse, externalNameAttribute) {
        let countriesData = [["Country"]];
        if(ObjectUtils.isValidObjectPath(contextEntitiesGetResponse, "response.content.entities.0")) {
            let entities = contextEntitiesGetResponse.response.content.entities;
            let isoNamePath = "data.attributes." + this.isoCountryNameAttribute + ".values.0.value";
            let externalNamePath = "data.attributes." + externalNameAttribute + ".values.0.value";
            entities.forEach((entity) => {
                let countryName;
                if(ObjectUtils.isValidObjectPath(entity, isoNamePath)) {
                    countryName = entity.data.attributes[this.isoCountryNameAttribute].values[0].value;
                } else if (ObjectUtils.isValidObjectPath(entity, externalNamePath)) {
                    countryName = entity.data.attributes[externalNameAttribute].values[0].value;
                }

                if(countryName) {
                    countriesData.push([countryName]);
                }
            })
        }

        this._loading = false;
        if(countriesData.length > 1) {
            this.set("_countriesData", countriesData);
            this.set("_loadGeoChart", true);
        } else {
            this.set("_loadGeoChart", false);
            this._message = "Entity does not have any country contexts";
        }
    }
}

customElements.define(PluginEntityGeographyViewer.is, PluginEntityGeographyViewer);