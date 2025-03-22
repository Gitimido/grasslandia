import{t as D,u as E,v as L}from"./chunk-FRFY5PE3.js";import"./chunk-7XC6FMWT.js";import{$ as d,G as b,J as g,K as v,Kb as I,La as O,Lb as B,Ma as y,Pa as M,V as s,W as p,Ya as S,Z as f,ba as x,ea as r,fa as i,ga as h,ja as u,ka as _,la as m,qa as k,ra as a,sa as C,xb as w,za as P}from"./chunk-TC4JDYVL.js";import"./chunk-ZQOO3JOD.js";import"./chunk-HMJPAHNJ.js";function T(o,t){o&1&&(r(0,"div",8),h(1,"div",9),r(2,"p"),a(3,"Loading bookmarks..."),i()())}function z(o,t){if(o&1){let e=u();r(0,"div",10)(1,"p",11),a(2),i(),r(3,"button",12),_("click",function(){g(e);let c=m();return v(c.loadSavedPosts())}),a(4,"Try Again"),i()()}if(o&2){let e=m();s(2),C(e.error)}}function V(o,t){o&1&&(r(0,"div",13)(1,"div",14)(2,"div",15),a(3,"\u{1F4D1}"),i(),r(4,"h3"),a(5,"No bookmarks yet"),i(),r(6,"p"),a(7,"When you save posts, they'll appear here for easy access."),i()()())}function Y(o,t){if(o&1){let e=u();r(0,"div",18)(1,"app-post-card",19),_("deleted",function(c){g(e);let l=m(2);return v(l.handlePostDeleted(c))})("unsaved",function(c){g(e);let l=m(2);return v(l.handleUnsavedPost(c))}),i()()}if(o&2){let e=t.$implicit,n=t.index;k("--index: ",n,";"),s(),d("post",e)}}function F(o,t){if(o&1&&(r(0,"div",16),f(1,Y,2,4,"div",17),i()),o&2){let e=m();s(),d("ngForOf",e.savedPosts)}}var N=class o{constructor(t,e,n,c,l){this.sideNavService=t;this.authService=e;this.postService=n;this.store=c;this.router=l;this.isLoggedIn$=this.store.select(I)}savedPosts=[];isLoading=!0;error;isSidebarCollapsed=!1;isLoggedIn$;authSubscription;sidebarSubscription;ngOnInit(){this.sidebarSubscription=this.sideNavService.sidebarState.subscribe(t=>{this.isSidebarCollapsed=t}),this.authSubscription=this.isLoggedIn$.subscribe(t=>{t?this.loadSavedPosts():this.router.navigate(["/signin"])})}ngOnDestroy(){this.authSubscription&&this.authSubscription.unsubscribe(),this.sidebarSubscription&&this.sidebarSubscription.unsubscribe()}loadSavedPosts(){let t=this.authService.user?.id;if(!t){this.error="You must be logged in to view bookmarks",this.isLoading=!1;return}this.isLoading=!0,this.error=void 0,this.postService.getSavedPosts(t).subscribe({next:e=>{this.savedPosts=e,this.isLoading=!1},error:e=>{console.error("Error loading bookmarks:",e),this.error="Failed to load bookmarks. Please try again later.",this.isLoading=!1}})}handlePostDeleted(t){this.savedPosts=this.savedPosts.filter(e=>e.id!==t)}handleUnsavedPost(t){this.savedPosts=this.savedPosts.filter(e=>e.id!==t)}static \u0275fac=function(e){return new(e||o)(p(L),p(B),p(D),p(w),p(S))};static \u0275cmp=b({type:o,selectors:[["app-bookmarks"]],standalone:!0,features:[P],decls:12,vars:6,consts:[[1,"bookmarks-container"],[1,"content-layout"],[1,"main-content"],[1,"bookmarks-header"],["class","loading-container",4,"ngIf"],["class","error-container",4,"ngIf"],["class","empty-container",4,"ngIf"],["class","bookmarks-feed",4,"ngIf"],[1,"loading-container"],[1,"loading-spinner"],[1,"error-container"],[1,"error-message"],[1,"retry-button",3,"click"],[1,"empty-container"],[1,"empty-state"],[1,"empty-icon"],[1,"bookmarks-feed"],["class","post-card-item",3,"style",4,"ngFor","ngForOf"],[1,"post-card-item"],[3,"deleted","unsaved","post"]],template:function(e,n){e&1&&(r(0,"div",0)(1,"div",1)(2,"div",2)(3,"div",3)(4,"h1"),a(5,"Your Bookmarks"),i(),r(6,"p"),a(7,"Posts you've saved for later"),i()(),f(8,T,4,0,"div",4)(9,z,5,1,"div",5)(10,V,8,0,"div",6)(11,F,2,1,"div",7),i()()()),e&2&&(x("sidebar-collapsed",n.isSidebarCollapsed),s(8),d("ngIf",n.isLoading),s(),d("ngIf",n.error),s(),d("ngIf",!n.isLoading&&!n.error&&n.savedPosts.length===0),s(),d("ngIf",!n.isLoading&&!n.error&&n.savedPosts.length>0))},dependencies:[M,O,y,E],styles:[".bookmarks-container[_ngcontent-%COMP%]{transition:margin-left var(--transition-normal);padding:24px;margin-left:250px;min-height:100vh;background-color:var(--background-color)}.bookmarks-container.sidebar-collapsed[_ngcontent-%COMP%]{margin-left:68px}@media (max-width: 768px){.bookmarks-container[_ngcontent-%COMP%]{margin-left:68px;padding:16px}}.content-layout[_ngcontent-%COMP%]{max-width:800px;margin:0 auto}.bookmarks-header[_ngcontent-%COMP%]{background-color:var(--card-background);border-radius:var(--radius-lg);box-shadow:var(--shadow-card);padding:24px;margin-bottom:24px;text-align:center;border:1px solid var(--border-color);animation:_ngcontent-%COMP%_fadeIn .3s ease}.bookmarks-header[_ngcontent-%COMP%]   h1[_ngcontent-%COMP%]{font-size:24px;font-weight:700;color:var(--text-color);margin-bottom:8px}.bookmarks-header[_ngcontent-%COMP%]   p[_ngcontent-%COMP%]{font-size:16px;color:var(--text-color);opacity:.7}@media (max-width: 768px){.bookmarks-header[_ngcontent-%COMP%]{padding:20px;margin-bottom:16px;border-radius:var(--radius-md)}}@keyframes _ngcontent-%COMP%_fadeIn{0%{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.loading-container[_ngcontent-%COMP%]{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 0;background-color:var(--card-background);border-radius:var(--radius-lg);box-shadow:var(--shadow-card);animation:_ngcontent-%COMP%_fadeIn .3s ease;border:1px solid var(--border-color)}.loading-container[_ngcontent-%COMP%]   .loading-spinner[_ngcontent-%COMP%]{width:48px;height:48px;border:3px solid var(--hover-color);border-top:3px solid var(--primary-color);border-radius:50%;animation:_ngcontent-%COMP%_spin 1s linear infinite;margin-bottom:20px}.loading-container[_ngcontent-%COMP%]   p[_ngcontent-%COMP%]{color:var(--text-color);opacity:.7;font-size:16px;font-weight:500}@media (max-width: 768px){.loading-container[_ngcontent-%COMP%]{border-radius:var(--radius-md)}}@keyframes _ngcontent-%COMP%_spin{0%{transform:rotate(0)}to{transform:rotate(360deg)}}.error-container[_ngcontent-%COMP%]{background-color:rgba(var(--error-color-rgb, 229, 57, 53),.1);border:1px solid rgba(var(--error-color-rgb, 229, 57, 53),.2);border-radius:var(--radius-lg);padding:24px;text-align:center;animation:_ngcontent-%COMP%_fadeIn .3s ease}.error-container[_ngcontent-%COMP%]   .error-message[_ngcontent-%COMP%]{color:var(--error-color);margin-bottom:16px;font-size:15px}.error-container[_ngcontent-%COMP%]   .retry-button[_ngcontent-%COMP%]{background-color:var(--error-color);color:#fff;border:none;border-radius:var(--radius-md);padding:10px 20px;cursor:pointer;font-weight:500;font-size:14px;transition:all var(--transition-fast)}.error-container[_ngcontent-%COMP%]   .retry-button[_ngcontent-%COMP%]:hover{opacity:.9;transform:translateY(-2px);box-shadow:0 4px 8px rgba(var(--error-color-rgb, 229, 57, 53),.2)}.error-container[_ngcontent-%COMP%]   .retry-button[_ngcontent-%COMP%]:active{transform:translateY(0)}@media (max-width: 768px){.error-container[_ngcontent-%COMP%]{border-radius:var(--radius-md);padding:20px}}.empty-container[_ngcontent-%COMP%]{background-color:var(--card-background);border-radius:var(--radius-lg);box-shadow:var(--shadow-card);padding:60px 20px;margin-bottom:24px;border:1px solid var(--border-color);animation:_ngcontent-%COMP%_fadeIn .3s ease}.empty-container[_ngcontent-%COMP%]   .empty-state[_ngcontent-%COMP%]{text-align:center;max-width:400px;margin:0 auto}.empty-container[_ngcontent-%COMP%]   .empty-icon[_ngcontent-%COMP%]{font-size:48px;margin-bottom:16px}.empty-container[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%]{font-size:20px;font-weight:600;color:var(--text-color);margin-bottom:8px}.empty-container[_ngcontent-%COMP%]   p[_ngcontent-%COMP%]{font-size:15px;color:var(--text-color);opacity:.7;line-height:1.5}@media (max-width: 768px){.empty-container[_ngcontent-%COMP%]{border-radius:var(--radius-md);padding:40px 20px}}.bookmarks-feed[_ngcontent-%COMP%]{display:flex;flex-direction:column;gap:20px;animation:_ngcontent-%COMP%_fadeIn .3s ease}.bookmarks-feed[_ngcontent-%COMP%]   .post-card-item[_ngcontent-%COMP%]{opacity:0;transform:translateY(20px);animation:_ngcontent-%COMP%_slide-up .5s forwards;animation-delay:calc(var(--index, 0) * .1s);transform-origin:center top;transition:all .3s ease-out}.bookmarks-feed[_ngcontent-%COMP%]   .post-card-item.removing[_ngcontent-%COMP%]{opacity:0;transform:translate(100%);height:0;margin:0;padding:0;overflow:hidden}@keyframes _ngcontent-%COMP%_slide-up{to{opacity:1;transform:translateY(0)}}@media (max-width: 768px){.bookmarks-feed[_ngcontent-%COMP%]{gap:16px}}"]})};export{N as BookmarksComponent};
