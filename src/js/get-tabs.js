define([
	"add-urls",
	"cp",
	"lodash"
], function(
	addURLs,
	cp,
	_
) {
	const TitlePattern = /ttl=([^&]+)/;


	return function getTabs(
		tabsPromise)
	{
		return Promise.all([
			tabsPromise,
			cp.tabs.query({
				active: true,
				currentWindow: true
			})
		])
			.then(function(result) {
				var tabs = result[0].tabs,
//				var tabs = result[0],
					activeTab = result[1][0],
					match;

					// remove the active tab from the array so it doesn't show up in
					// the results, making it clearer if you have duplicate tabs open
				_.remove(tabs, { id: activeTab.id });

				tabs.forEach(function(tab) {
					addURLs(tab);

						// if the tab is suspended, check if it it's in the bad
						// state where The Great Suspender hasn't updated its
						// title so it just says "Suspended Tab".  if so, pull
						// the title from the ttl param that TGS puts in the URL.
					if (tab.unsuspendURL && tab.title == "Suspended Tab") {
						match = tab.url.match(TitlePattern);

						if (match) {
								// try to use decodeURIComponent() to unescape
								// the ttl param, which sometimes throws if it
								// doesn't like the encoding
							try {
								tab.title = decodeURIComponent(match[1]);
							} catch (e) {
								try {
									tab.title = unescape(match[1]);
								} catch (e) {}
							}
						}
					}
				});

				return tabs;
			});
	}
});
