define(["mvc/form/form-view","mvc/ui/ui-misc"],function(a,b){var c=Backbone.View.extend({initialize:function(){this.form_def={information:{title:"Manage your information (email, address, etc.)",url:"api/user_preferences/"+Galaxy.user.id+"/information",icon:"fa-info-circle"},password:{title:"Change your password",icon:"fa-key",url:"api/user_preferences/"+Galaxy.user.id+"/password",submit_title:"Save password"},communication:{title:"Change your communication settings",url:"api/user_preferences/"+Galaxy.user.id+"/communication",icon:"fa-child",auto_save:!0},permissions:{title:"Change default permissions for new histories",url:"api/user_preferences/"+Galaxy.user.id+"/permissions",icon:"fa-lock",submit_title:"Save permissions"},api_key:{title:"Manage your API keys",url:"api/user_preferences/"+Galaxy.user.id+"/api_key",icon:"fa-key",submit_title:"Create a new key",submit_icon:"fa-check"},toolbox_filters:{title:"Manage your Toolbox filters",url:"api/user_preferences/"+Galaxy.user.id+"/toolbox_filters",icon:"fa-filter",submit_title:"Save filters"}},this.setElement("<div/>"),this.render()},_load:function(c){var d=this,e=function(a){$.ajax({url:c.url,data:a.data.create(),type:"PUT",traditional:!0}).done(function(b){a.data.matchModel(b,function(b,c){a.field_list[c].value(b.value)}),a.message.update({message:b.message,status:"success"})}).fail(function(b){a.message.update({message:b.responseJSON.err_msg,status:"danger"})})},f=new a({title:c.title,icon:c.icon,inputs:c.inputs,operations:{back:new b.ButtonIcon({icon:"fa-caret-left",tooltip:"Return to user preferences",title:"Preferences",onclick:function(){f.remove(),d.$preferences.show()}})},onchange:function(){c.auto_save&&e(f)},buttons:!c.auto_save&&{submit:new b.Button({tooltip:c.submit_tooltip,title:c.submit_title||"Save settings",icon:c.submit_icon||"fa-save",cls:"ui-button btn btn-primary",floating:"clear",onclick:function(){e(f)}})}});this.$preferences.hide(),this.$el.append(f.$el)},_link:function(a){var b=this,c=$('<a target="galaxy_main" href="javascript:void(0)">'+a.title+"</a>").on("click",function(){$.ajax({url:Galaxy.root+a.url,type:"GET"}).always(function(c){b._load($.extend({},a,c))})});this.$pages.append($("<li/>").append(c))},render:function(){var a=this;$.getJSON(Galaxy.root+"api/user_preferences",function(b){if(a.$preferences=$("<div/>"),null!==b.id){if(a.$preferences.append($("<h2/>").append("User preferences")).append($("<p/>").append("You are currently logged in as "+_.escape(b.email)+".")).append(a.$pages=$("<ul/>")),b.remote_user||(a._link(a.form_def.information),a._link(a.form_def.password)),"galaxy"==b.webapp?(a._link(a.form_def.communication),a._link(a.form_def.permissions),a._link(a.form_def.api_key),a._link(a.form_def.toolbox_filters),b.openid&&!b.remote_user&&a._link({title:"Manage OpenIDs linked to your account"})):(a._link(a.form_def.api_key),a._link({title:"Manage your email alerts"})),"galaxy"==b.webapp){var c="<p>You are using <strong>"+b.disk_usage+"</strong> of disk space in this Galaxy instance. ";b.enable_quotas&&(c+="Your disk quota is: <strong>"+b.quota+"</strong>. "),c+='Is your usage more than expected?  See the <a href="https://wiki.galaxyproject.org/Learn/ManagingDatasets" target="_blank">documentation</a> for tips on how to find all of the data in your account.</p>',a.$preferences.append(c)}}else b.message||a.$preferences.append("<p>You are currently not logged in.</p>"),$preferences('<ul><li><a target="galaxy_main">Login</a></li><li><a target="galaxy_main">Register</a></li></ul>');a.$el.empty().append(a.$preferences)})}});return{UserPreferences:c}});
//# sourceMappingURL=../../../maps/mvc/user/user-preferences.js.map