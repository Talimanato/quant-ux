<template>
    <div class="MatcStudio">
        <SplitContainer :left="256" :min="48" qui="Studio">
            <template v-slot:left>
                <div class="MatcStudioNav">
                    <div class="MatcStudioLogo">        
                        <img src="../../style/img/QUXLogoBlack.svg" class="MatcStudioLogo" ref="logo"> 
                        <span class="MatcCollapseViewMinHidden">Quant-UX</span>               
                    </div>
                    

                    <div class="MatcMarginTop MatcCollapseViewMinHidden">        
                        <button @click="showNewDialog" class="MatcButton MatcButtonFullWidth MatcButtonPrimary MatcRoundButton">
                            <QIcon icon="Plus"/>
                            <span class="MatcCollapseViewMinHidden"> 
                                {{ $t('app.create') }}
                            </span>
                        </button>      
                    </div>

                    <div class="MatcStudioNavRow MatcMarginTop MatcCollapseViewMinVisible" @click="showNewDialog">
                        <a class="MatcLink MatcStudioNavItem">
                            <QIcon icon="Plus" :tooltip="$t('app.create')" ></QIcon>
                        </a>
                    </div>

                    <div class="MatcStudioNavRow MatcMarginTop MatcCollapseViewMinVisible">
                        <a class="MatcLink MatcStudioNavItem" @click="showAppsDialog">
                            <QIcon icon="Projects" :tooltip="$t('app.recent-projects')"></QIcon>
                        </a>
                    </div>

                    <div class="MatcStudioNavRow MatcMarginTop">
                        <h4 class="MatcCollapseViewMinHidden"> {{ $t('app.recent-projects') }}</h4>                 
                    </div>
 
                    <div class="MatcStudioAppList MatcMarginBottom MatcScrollContainer">
                        <a v-for="app in filteredAppList" 
                            :key="app.id" :href="'#/' + urlPrefix +'/' + app.id + '.html'" 
                            :class="['MatcLink MatcStudioNavItem MatcCollapseViewMinHidden', {'MatcStudioAppListSelected' : selectedApp === app.id}]">
                            <span class="MatcStudioAppListDot" :style="{'background': app.previewColor}"/>
                            <span class="MatcStudioAppListLabel">
                                {{app.name}}
                            </span>                                      
                        </a>
                        <a v-if="hasMore" @click="showAppsDialog" class="MatcActionLink MatcStudioNavItem MatcCollapseViewMinHidden">
                            <span class="MatcStudioAppListDot" style="opacity: 0;"/>
                            <span class="MatcStudioAppListLabel MatcStudioAction ">
                                {{$t('app.more')}}
                            </span>    
                        </a>
                        <div v-if="isLoading" class="MatcStudioAppListLoading">

                            {{$t('app.loading')}}
                        </div>
                        <div v-else-if="filteredAppList.length === 0" class="MatcStudioAppListEmpty MatcCollapseViewMinHidden">
                            {{$t('app.recent-projects-empty')}}
                        </div>
                    </div>

                    <div class="MatcStudioNavRow">
                        <a class="MatcLink MatcStudioNavItem" href="#/libs.html">
                            <QIcon icon="Component"/>
                            <span class="MatcCollapseViewMinHidden">
                                {{ $t('library.title') }}
                            </span>
                        </a>
                    </div>

                    <div class="MatcStudioNavRow">
                        <a class="MatcLink MatcStudioNavItem" href="#/help.html">
                            <QIcon icon="Book"/>
                            <span class="MatcCollapseViewMinHidden">
                                {{ $t('app.help') }}
                            </span>
                        </a>
                    </div>

                    <div class="MatcStudioNavRow MatcStudioNavRowPicker">
                        <LanguagePicker :hasLabel="true" @change="setLanguage" />
                    </div>

                    <div class="MatcStudioNavRow">
                        <StudioContact :user="user" />
                    </div>
                    

                    <div class="MatcStudioNavRow"  v-if="!pub">
                        <a class="MatcLink MatcStudioNavItem" href="#/my-account.html" >
                            <QIcon icon="Account" v-if="!hasUserImage" ></QIcon>
                            <span class="MatcUserImageCntr " v-else>
                                <img class="MatcUserImage" :src="userImage">
                            </span>
                            <span class="MatcCollapseViewMinHidden">
                                {{userName}}
                            </span>

                        </a>
                    </div>

                    <!-- <div class="MatcStudioNavRow">
                        <a class="MatcLink" @click="onLogout">
                            <QIcon icon="Logout"/>
                            <span class="MatcCollapseViewMinHidden">
                                {{ $t('app.logout') }}       
                            </span>
                              
                        </a>
                    </div>        -->
          
                </div>
   
        
            
            </template>

            <template v-slot:right>
                <StudioOverview v-if="selectedApp" :user="user" @change="onChangeAppProps" @delete="onDeleteApp" @duplicate="onDuplicate"/>
                <div class="MatcStudioWelcome" v-else>

                    <div class="">
                        <h3>{{$t('app.welcome-headline')}}</h3>
                        <div>
                            {{$t('app.welcome-intro')}}
                        </div>
                    </div>
              

                </div>

            </template>

        </SplitContainer>

        <CreateAppDialog ref="createDialog"></CreateAppDialog>
        <AppListDialog ref="appsDialog"></AppListDialog>
    </div>
</template>
<style lang="scss">
  @import "../../style/matc.scss";
    @import "../../style/studio.scss";
</style>
<script>
import Logger from "common/Logger";
import DojoWidget from "dojo/DojoWidget";
import Services from "services/Services";
import SplitContainer from "page/CollapseContainer";
import StudioOverview from './StudioOverview'
import CreateAppDialog from "page/CreateAppDialog";
import QIcon from "page/QIcon";
import AppListDialog from './AppListDialog'
import StudioContact from './StudioContact'
import LanguagePicker from 'page/LanguagePicker'

export default {
    name: "Studio",
    mixins: [DojoWidget],
    data: function () {
        return {
            isLoading: true,
            selectedApp: null,
            apps: [],
            user: null
        };
    },
    components: {
        'SplitContainer': SplitContainer,
        'StudioOverview': StudioOverview,
        'CreateAppDialog': CreateAppDialog,
        'QIcon': QIcon,
        'AppListDialog': AppListDialog,
        'StudioContact': StudioContact,
        'LanguagePicker': LanguagePicker
    },
    computed: {
        hasMore () {
            if (this.filteredAppList.length === 0) {
                return false
            }
            return this.apps.length > 10
        },
        filteredAppList () {
            //return []
            if (this.apps.length > 10) {
                return this.apps.slice(0, 10) 
            }
            return this.apps
        },
        hasUserImage () {
            return false
        },
        userName () {
            return 'My Account'
        },
        urlPrefix () {
            if (!this.pub) {
                return 'apps'
            } else {
                return 'examples'
            }
        },
        pub() {
            return this.$route.meta && this.$route.meta.isPublic === true;
        },
    },
    methods: {
        setLanguage (language) {
            this.logger.log(-1, 'setLanguage', 'entry', language)
            Services.getUserService().setLanguage(language)
            this.$root.$i18n.locale = language
        },
        onDuplicate () {
            this.load()
        },
        onDeleteApp (app) {
            this.apps = this.apps.filter(a => a.id !== app.id)
            this.setDefaultApp()
        },
        onChangeAppProps (app) {
            const found = this.apps.find(a => a.id === app.id)
            if (found) {
                found.name = app.name
                found.previewColor = app.previewColor
                this.$forceUpdate()  
            } else {
                console.error(found, app)
            }
        },
        showAppsDialog (e) {
            this.$refs.appsDialog.show(this.apps, e)
        },
        showNewDialog (e) {
            this.$refs.createDialog.show(e)
        },

        async load() {
            if (this.pub) {
                let summaries = await Services.getModelService().findPublicSummaries();
                this.setApps(summaries);
            } else {
                let summaries = await Services.getModelService().findMyAppSummaries();
                this.setApps(summaries);
            }
        },

        async setApps(value) {
            this.logger.log(0, "setApps", "enter > " + value.length);
            this.isLoading = false
            value.sort((a, b) => {
                return b.lastUpdate - a.lastUpdate;
            });
            value.forEach(a => {
                if (!a.previewColor) {
                    a.previewColor = ''
                }
            })
            this.apps = value
        },
        initRoute() {
            this.logger.log(3, "initRoute", "enter > " + this.$route.params.id);
            if (this.$route.params.id) {
                this.selectedApp = this.$route.params.id
            } else {
               this.setDefaultApp()
            }
        },
        setDefaultApp () {
            if (this.apps.length > 0 && !this.defaultDispatched) {
                const app = this.apps[0]
                this.defaultDispatched = true
                /**
                 * The push is deferred and re-checked: the user might
                 * navigate away while load() resolves (e.g. straight into
                 * the editor). A queued push would then hijack that
                 * navigation, because vue-router resolves it last.
                 * location.hash is the synchronous source of truth here.
                 */
                this.$nextTick(() => {
                    if (this.isUnmounted) {
                        return
                    }
                    if (location.hash === '' || location.hash === '#' || location.hash === '#/') {
                        if (this.pub) {
                            this.$router.push(`/examples/${app.id}.html`)
                        } else {
                            this.$router.push(`/apps/${app.id}.html`)
                        }
                    }
                })
            }
        },
        onLogout () {
            Services.getUserService().logout()
            this.$emit('logout', Services.getUserService().GUEST)
            this.$router.push(`/`)                  
        }

    },
    watch: {
        $route() {
            this.logger.log(-1, "watch", "route");
            this.initRoute();
        }
    },
    async mounted() {
        this.logger = new Logger("Studio");
        this.user = Services.getUserService().getUser();
        await this.load();
        /**
         * load() can resolve after the user has already navigated away
         * (e.g. straight into the editor). initRoute() would then push the
         * default app route and hijack that navigation - do nothing once
         * the component is unmounted.
         */
        if (this.isUnmounted) {
            return
        }
        this.initRoute();
        this.logger.log(2,"mounted", "exit > ", this.user);
    },
    beforeUnmount () {
        this.isUnmounted = true
    }
};
</script>
  
  