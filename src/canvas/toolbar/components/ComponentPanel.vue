<template>
    <div
        class="MatcComponentPanel"
        :class="{'MatcComponentPanelClosed': !open}"
        :aria-hidden="!open">
        <div class="MatcComponentPanelRail">
            <ComponentPanelCategory
                v-for="cat in visibleCategories"
                :key="cat"
                :category="cat"
                :selected="selectedCategory === cat"
                @select="onSelectCategory" />
        </div>
        <div class="MatcComponentPanelBody">
            <div class="MatcComponentPanelSearch">
                <i class="MatcComponentPanelSearchIcon mdi mdi-magnify"></i>
                <input
                    type="search"
                    class="MatcComponentPanelSearchInput"
                    v-model="query"
                    :placeholder="getNLS('toolbar.componentPanel.searchPlaceholder')" />
                <button v-if="query" class="MatcComponentPanelSearchClear mdi mdi-close" @click.stop="query = ''"></button>
            </div>
            <div class="MatcComponentPanelList" v-if="items.length > 0">
                <ComponentPanelItem
                    v-for="item in items"
                    :key="item.id"
                    :item="item"
                    :selected="selectedItem && selectedItem.id === item.id"
                    @select="onSelect"
                    @dragstart="onDragStart"
                    @dragend="onDragEnd" />
            </div>
            <div v-else class="MatcComponentPanelEmpty">
                {{getNLS('toolbar.componentPanel.empty')}}
            </div>
        </div>
    </div>
</template>
<script>
import NLS from 'common/NLS'
import ComponentPanelCategory from './ComponentPanelCategory'
import ComponentPanelItem from './ComponentPanelItem'
import { loadComponentData, CATEGORY_ORDER } from './ComponentData'

export default {
    name: 'ComponentPanel',
    mixins: [NLS],
    props: ['model', 'open'],
    emits: ['select', 'dragstart', 'dragend'],
    data: function () {
        return {
            isLoading: true,
            categories: {},
            selectedCategory: null,
            selectedItem: null,
            query: ''
        }
    },
    components: {
        'ComponentPanelCategory': ComponentPanelCategory,
        'ComponentPanelItem': ComponentPanelItem
    },
    computed: {
        visibleCategories () {
            const result = CATEGORY_ORDER.filter(cat => {
                return this.categories[cat] && Object.keys(this.categories[cat]).length > 0
            })
            if (this.categories['Template'] && Object.keys(this.categories['Template']).length > 0) {
                if (result.indexOf('Template') === -1) {
                    result.push('Template')
                }
            }
            return result
        },
        items () {
            if (this.query && this.query.length > 1) {
                return this.getSearchResult()
            }
            if (this.selectedCategory && this.categories[this.selectedCategory]) {
                return this.getItemsForCategory(this.selectedCategory)
            }
            return []
        }
    },
    watch: {
        model (v) {
            this.load(v)
        },
        visibleCategories (v) {
            if (v.length > 0 && (!this.selectedCategory || v.indexOf(this.selectedCategory) === -1)) {
                this.selectedCategory = v[0]
            }
        }
    },
    methods: {
        async load (model) {
            try {
                this.categories = await loadComponentData(model)
                this.isLoading = false
            } catch (err) {
                console.error('ComponentPanel.load() > Error', err)
                this.isLoading = false
            }
        },
        onSelectCategory (cat) {
            this.selectedCategory = cat
            this.query = ''
        },
        getItemsForCategory (cat) {
            const children = this.categories[cat]
            const elements = []
            for (let id in children) {
                elements.push(children[id])
            }
            return elements.sort((a, b) => {
                if (a.subcategory && b.subcategory) {
                    if (a.subcategory === b.subcategory) {
                        return (a.name || '').localeCompare(b.name || '')
                    }
                    return a.subcategory.localeCompare(b.subcategory)
                }
                return (a.name || '').localeCompare(b.name || '')
            })
        },
        getSearchResult () {
            const q = this.query.toLowerCase()
            const result = []
            for (let cat in this.categories) {
                const children = this.categories[cat]
                for (let id in children) {
                    const child = children[id]
                    const name = (child.name || '').toLowerCase()
                    const sub = (child.subcategory || '').toLowerCase()
                    if (name.indexOf(q) >= 0 || sub.indexOf(q) >= 0) {
                        result.push(child)
                    }
                }
            }
            return result.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        },
        onSelect (item) {
            this.selectedItem = item
            this.$emit('select', item)
        },
        onDragStart (item) {
            this.$emit('dragstart', item)
        },
        onDragEnd (item) {
            this.$emit('dragend', item)
        }
    },
    mounted () {
        if (this.model) {
            this.load(this.model)
        }
    }
}
</script>
