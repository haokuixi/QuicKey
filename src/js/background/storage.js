define([
	"bluebird",
	"cp",
	"./mutex",
	"./page-trackers"
], function(
	Promise,
	cp,
	Mutex,
	trackers
) {
	function emptyDefaultData()
	{
		return Promise.resolve({});
	}


	function alwaysValidate()
	{
		return true;
	}


	function returnData(
		data)
	{
		return data;
	}


	return function createStorage(
		options)
	{
		const storageMutex = new Mutex(Promise);
		const {
			version = 1,
			getDefaultData = emptyDefaultData,
			validateUpdate = alwaysValidate,
			updaters = {}
		} = options;
		let dataPromise = getAll();


		function getAll()
		{
				// pass null to get everything in storage
			return cp.storage.local.get(null)
				.then(function(storage) {
					if (!storage || !storage.data) {
							// this is likely a new install, so reset the storage
							// to the default.  we need to do this without locking
							// the mutex because doTask() locks it and then calls
							// this promise, so if we called the locking reset
							// from here, it would never complete.
						return resetWithoutLocking();
					} else {
							// update the existing storage to the latest version,
							// if necessary
						return update(storage);
					}
				});
		}


		function update(
			storage)
		{
			let updated = false;

			while (updaters[storage.version]) {
				const [data, version] = updaters[storage.version](storage.data,
					storage.version);

				storage.data = data;
				storage.version = version;
			}

			if (storage.version === version) {
				updated = validateUpdate(storage.data);
			}

			if (updated) {
					// save the updated data and version to storage
				return saveWithVersion(storage.data);
			} else {
				trackers.background.event("storage", storage.version === version ?
					"failed-validation" : "failed-update");

					// we couldn't find a way to update the existing storage to
					// the new version or the update resulted in invalid data,
					// so just reset it to the default
				return resetWithoutLocking();
			}
		}


		function saveWithVersion(
			data)
		{
			return cp.storage.local.set({
				version: version,
				data: data
			})
				.return(data);
		}


		function save(
			data)
		{
			return cp.storage.local.set({ data: data })
				.return(data);
		}


		function resetWithoutLocking()
		{
			return cp.storage.local.clear()
				.then(getDefaultData)
				.then(saveWithVersion)
				.then(function(data) {
						// normally, dataPromise points to the resolved
						// promise from getAll() that was created when
						// createStorage() was first called and returns the
						// in-memory version of the data object from storage.
						// but since we just cleared that, we need to update
						// the promise to point to the fresh data in memory.
					return dataPromise = Promise.resolve(data);
				});
		}


		function doTask(
			task,
			thisArg,
			saveResult)
		{
			return storageMutex.lock(function() {
				return dataPromise
					.then(function(data) {
						return Promise.resolve(task.call(thisArg, data))
							.then(function(newData) {
								if (saveResult && newData) {
										// since all the values are stored on the
										// .data key of the storage instead of at
										// the topmost level, we need to update
										// that object with the changed data
										// before calling save().  otherwise, we'd
										// lose any values that weren't changed
										// and returned by the task function.
									Object.assign(data, newData);

									return save(data);
								} else {
									return newData;
								}
							});
					});
			});
		}


		function set(
			task,
			thisArg)
		{
			return doTask(task, thisArg, true);
		}


		function get(
			task,
			thisArg)
		{
				// if a function isn't passed in, use a noop function that will
				// just return the data as a promise, so the caller can handle
				// it in a then() chain
			return doTask(task || returnData, thisArg, false);
		}


		function reset()
		{
			return storageMutex.lock(resetWithoutLocking);
		}


		return {
			get: get,
			set: set,
			reset: reset
		};
	}
});
