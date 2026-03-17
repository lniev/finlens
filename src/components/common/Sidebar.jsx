const navItems = [
	{ id: "record", label: "录制", icon: "🎥" },
	{ id: "history", label: "历史记录", icon: "📁" },
	{ id: "settings", label: "设置", icon: "⚙️" },
];

function Sidebar({ currentPage, onPageChange }) {
	return (
		<aside className="sidebar">
			<h1 className="app-title">🎬 直播录制</h1>
			<nav>
				<ul className="nav-menu">
					{navItems.map(item => (
						<li
							key={item.id}
							className={`nav-item ${currentPage === item.id ? "active" : ""}`}
							onClick={() => onPageChange(item.id)}
						>
							<span className="nav-icon">{item.icon}</span>
							<span>{item.label}</span>
						</li>
					))}
				</ul>
			</nav>
		</aside>
	);
}

export default Sidebar;
