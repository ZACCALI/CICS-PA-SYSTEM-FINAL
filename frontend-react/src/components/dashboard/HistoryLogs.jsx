import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import Modal from '../common/Modal';

const HistoryLogs = () => {
  const { activityLogs } = useApp();
  const [filter, setFilter] = useState('All');
  const [selectedLog, setSelectedLog] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const filteredLogs = activityLogs.filter(log => 
      filter === 'All' ? true : log.type === filter
  );

  const handleRowClick = (log) => {
      setSelectedLog(log);
      setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 flex items-center">
        <i className="material-icons mr-3 text-primary">history_edu</i> System Audit Logs
      </h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-semibold text-gray-700">Recent Activity</h3>
            <div className="flex space-x-2">
                {['All', 'Text', 'Voice', 'System', 'Emergency'].map(f => (
                    <button 
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${filter === f ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 border-b border-gray-200 font-semibold text-gray-700 uppercase tracking-wider text-xs">
                    <tr>
                        <th className="px-6 py-4">Time</th>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Action</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Details</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredLogs.length > 0 ? (
                        filteredLogs.map(log => (
                            <tr 
                                key={log.id} 
                                onClick={() => handleRowClick(log)}
                                className="hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">{log.time}</td>
                                <td className="px-6 py-4 font-medium text-gray-900">{log.user}</td>
                                <td className="px-6 py-4">{log.action}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 text-xs rounded-full font-bold uppercase 
                                        ${log.type === 'Emergency' ? 'bg-red-100 text-red-700' : 
                                          log.type === 'Voice' ? 'bg-green-100 text-green-700' :
                                          log.type === 'Text' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {log.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-500 max-w-xs truncate" title={log.details}>
                                    {log.details}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                                No activity logs found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {selectedLog && (
        <Modal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            title="Log Details"
            footer={
                <button onClick={() => setShowModal(false)} className="px-6 py-2 bg-primary text-white rounded-lg">Close</button>
            }
        >
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase">Action</label>
                    <p className="text-lg font-bold text-gray-800">{selectedLog.action}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">User</label>
                        <p className="text-gray-700">{selectedLog.user}</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">Time</label>
                        <p className="text-gray-700 font-mono text-sm">{selectedLog.time}</p>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase">Details</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg border border-gray-100 text-gray-700 whitespace-pre-wrap font-mono text-sm">
                        {selectedLog.details}
                    </div>
                </div>
                <div>
                    <span className={`px-2 py-1 text-xs rounded-full font-bold uppercase 
                        ${selectedLog.type === 'Emergency' ? 'bg-red-100 text-red-700' : 
                          selectedLog.type === 'Voice' ? 'bg-green-100 text-green-700' :
                          selectedLog.type === 'Text' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {selectedLog.type}
                    </span>
                </div>
            </div>
        </Modal>
      )}
    </div>
  );
};

export default HistoryLogs;
