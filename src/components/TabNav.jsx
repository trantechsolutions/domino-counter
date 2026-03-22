const tabs = [
  { id: 'tracker', label: 'Score Tracker' },
  { id: 'pip_counter', label: 'Pip Counter' },
];

export default function TabNav({ activeTab, onTabChange }) {
  return (
    <div className="mb-5 bg-gray-100 rounded-xl p-1 flex">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition ${
            activeTab === tab.id
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
