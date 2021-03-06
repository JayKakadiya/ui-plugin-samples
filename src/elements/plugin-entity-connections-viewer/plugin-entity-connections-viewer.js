import { LitElement, html, css } from 'lit-element/lit-element.js';

// ui-platform-utils
import { ContextUtils } from 'ui-platform-utils/lib/mdm/ContextUtils.js';
import { ObjectUtils } from 'ui-platform-utils/lib/common/ObjectUtils.js';

// ui-platform-dataaccess
import { DataAccessManager } from 'ui-platform-dataaccess/lib/index.js';
import { EntityCompositeModelManager } from 'ui-platform-dataaccess/lib/managers/EntityCompositeModelManager.js';

import "./vis-network.min.js";

class PluginEntityConnectionsViewer extends LitElement {

    static get properties() {
        return {
            contextData: {
                type: Object
            }
        };
    }

    static get styles() {
        return css`
            #mynetwork {
                width: 100%;
                height: 100%;
            }
        `;
    }

    constructor() {
        super();

        this.contextData = {};
    }

    render() {
        return html`<div id="mynetwork"></div>`;
    }

    firstUpdated() {
        this._renderGraph();
    }

    attributeChangedCallback(name, oldVal, newVal) {
        super.attributeChangedCallback(name, oldVal, newVal);
        console.log("Plugin entity graph view attributeChangedCallback called . . .", name);
    }

    async _renderGraph() {
        let entityId, entityType;
        let firstItemContext = ContextUtils.getFirstItemContext(this.contextData);

        if (firstItemContext) {
            entityId = firstItemContext.id;
            entityType = firstItemContext.type;
        }

        if (!ObjectUtils.isEmpty(entityId) && !ObjectUtils.isEmpty(entityType)) {

            let relationshipModels = await this._getRelationshipModelOfEntityType(entityType);

            if (relationshipModels) {
                let entityGraphNodes = [];
                let entityGraphEdges = [];
                let { relNodes, relEdges } = this._createRelationshipNodesFromModel(entityId, relationshipModels);

                let { relEntityNodes, relEntityEdges, contextNodes, contextEdges } = await this._createRelatedEntityNodes(entityId, entityType, relNodes);

                entityGraphNodes = [...entityGraphNodes, ...relEntityNodes, ...relNodes, ...contextNodes];
                let nodes = new vis.DataSet(entityGraphNodes);

                entityGraphEdges = [...entityGraphEdges, ...relEntityEdges, ...relEdges, ...contextEdges];

                let edges = new vis.DataSet(entityGraphEdges);

                let container = this.shadowRoot.querySelector('#mynetwork');
                let data = {
                    nodes: nodes,
                    edges: edges
                };

                let options = {
                    layout: {
                        hierarchical: false,
                    },
                    edges: {
                        color: '#000000',
                    },
                    interaction: {
                        navigationButtons: true,
                        hover: false
                    }
                }

                new vis.Network(container, data, options);
            }
        }
    }

    async _getRelationshipModelOfEntityType(entityType) {
        let relationshipModels = {};
        let valContexts = ContextUtils.getValueContexts(this.contextData);
        let dataContexts = ContextUtils.getDataContexts(this.contextData);

        let coalesceOptions = await this._getCoalesceOptions();

        let compositeModelRequest = {
            "params": {
                "query": {
                    "filters": {
                        "typesCriterion": [
                            "entityCompositeModel"
                        ]
                    },
                    "valueContexts": valContexts,
                    "contexts": dataContexts,
                    "name": entityType
                },
                "fields": {
                    "relationships": ["_ALL"]
                },
                "options": {
                    "coalesceOptions": coalesceOptions
                }
            }
        }

        let response = await EntityCompositeModelManager.getCompositeModel(compositeModelRequest, this.contextData);

        if (response) {
            //console.log("relationshipModels", response);
            relationshipModels = response.data.relationships;
        }

        return relationshipModels;
    }

    async _getCoalesceOptions() {
        let coalesceOptions = await EntityCompositeModelManager.getCoalesceOptions(this.contextData);
        return coalesceOptions;
    }

    _createRelationshipNodesFromModel(entityId, relationshipModels) {
        let relNodes = [];
        let relEdges = [];

        for (let relModelKey in relationshipModels) {
            let relModels = relationshipModels[relModelKey];

            if (relModels) {

                let ownedRelModel = relModels.find(v => v.properties.relationshipOwnership == "owned");

                if (ownedRelModel) {
                    relNodes.push({
                        id: relModelKey,
                        label: ownedRelModel.properties.externalName,
                        shape: 'hexagon',
                        color: {
                            background: "orange"
                        }
                    });

                    relEdges.push({
                        from: entityId,
                        to: relModelKey,
                        color: "green"
                    });
                }
            }
        }

        return {
            relNodes: relNodes,
            relEdges: relEdges
        };
    }

    async _createRelatedEntityNodes(entityId, entityType, relationshipNodes) {
        let contextNodes = [];
        let contextEdges = [];
        let relEntityNodes = [];
        let relEntityEdges = [];
        let valContexts = ContextUtils.getValueContexts(this.contextData);
        let dataContexts = ContextUtils.getDataContexts(this.contextData);
        let relationshipTypes = relationshipNodes.map(v => v.id);

        if (relationshipTypes) {
            let entityGetRequest = {
                "params": {
                    "query": {
                        "id": entityId,
                        "contexts": dataContexts,
                        "valueContexts": valContexts,
                        "filters": {
                            "typesCriterion": [entityType]
                        }
                    },
                    "fields": {
                        "relationships": relationshipTypes
                    }
                }
            };

            let createEntityGetRequest = DataAccessManager.createRequest("getbyids", entityGetRequest, undefined, {});
            let entityGetResponse = await DataAccessManager.initiateRequest(createEntityGetRequest);

            if (ObjectUtils.isValidObjectPath(entityGetResponse, "response.status") && entityGetResponse.response.status == "success") {
                let entity = ObjectUtils.isValidObjectPath(entityGetResponse, "response.content.entities.0") ? entityGetResponse.response.content.entities[0] : undefined;
                //console.log("entity", entity);
                if (entity) {
                    let entityData = entity.data;
                    let rootNode = { "id": entity.id, "label": entity.name, shape: 'triangle', "color": { background: "green" } };
                    relEntityNodes.push(rootNode);

                    let relationships = entityData.relationships;

                    if (!ObjectUtils.isEmpty(entityData.contexts)) {
                        for (let entityContext of entityData.contexts) {
                            let context = entityContext.context;
                            let contextRels = entityContext.relationships;

                            let contextValue = context[Object.keys(context)[0]];

                            contextNodes.push({
                                id: contextValue,
                                label: contextValue,
                                size: 14,
                                shape: "square",
                                color: {
                                    background: "grey"
                                }
                            });

                            if (contextRels) {
                                this._createRelNodesAndEdges(contextRels, relEntityNodes, relEntityEdges, contextValue, contextEdges);
                            }
                        }
                    } else {
                        if (relationships) {
                            this._createRelNodesAndEdges(relationships, relEntityNodes, relEntityEdges);
                        }
                    }
                }
            }
        }

        return {
            relEntityNodes: relEntityNodes,
            relEntityEdges: relEntityEdges,
            contextNodes: contextNodes,
            contextEdges: contextEdges
        };
    }

    _createRelNodesAndEdges(relationships, relEntityNodes, relEntityEdges, contextValue, contextEdges) {
        for (let relKey in relationships) {
            let rels = relationships[relKey];

            for (let rel of rels) {
                let relToId = rel.relTo.id;

                if (!this._isNodeExist(relEntityNodes, relToId)) {
                    relEntityNodes.push({
                        id: relToId,
                        label: relToId,
                        shape: "dot",
                        size: 16,
                        color: {
                            background: "#026bc3"
                        }
                    });
                }

                if (rel.os && rel.os == "contextCoalesce") {
                    if (!this._isEdgeExist(relEntityEdges, relKey, relToId)) {
                        relEntityEdges.push({
                            from: relKey,
                            to: relToId,
                            color: "orange"
                        });
                    }
                } else {
                    if (!this._isEdgeExist(relEntityEdges, contextValue, relToId)) {
                        relEntityEdges.push({
                            from: contextValue,
                            to: relToId,
                            color: "grey"
                        });
                    }

                    if (!this._isEdgeExist(relEntityEdges, relKey, relToId)) {
                        relEntityEdges.push({
                            from: relKey,
                            to: relToId,
                            color: "orange",
                            dashes: contextValue ? true : false
                        });
                    }

                }
            }

            if (contextValue) {
                contextEdges.push({
                    from: contextValue,
                    to: relKey,
                    color: "orange"
                });
            }
        }
    }

    _isNodeExist(nodes, nodeId) {
        if (nodes) {
            let isNodeExist = nodes.find(v => v.id == nodeId);
            if (isNodeExist) {
                return true;
            }
        }
        return false;
    }

    _isEdgeExist(edges, from, to) {
        if (edges) {
            let isEdgeExist = edges.find(v => v.from == from && v.to == to);
            if (isEdgeExist) {
                return true;
            }
        }
        return false;
    }

}

customElements.define('plugin-entity-connections-viewer', PluginEntityConnectionsViewer);