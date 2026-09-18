import { UI_THEMES, type UiThemeId } from "../domain/uiThemes";
import { navigationItems } from "../navigation";

export function AppearanceSettingsPage() {
  return <>
    <header className="page-header">
      <div>
        <div className="eyebrow">개인 설정</div>
        <h2>화면 스타일 설정</h2>
        <p className="muted">앱 전체 디자인 또는 각 메뉴의 디자인을 개인 취향에 맞게 선택할 수 있습니다.</p>
      </div>
    </header>

    <section className="card">
      <h3>전체 디자인 스타일</h3>
      <div className="grid two">
        {UI_THEMES.map((theme) => <label className="list-item" key={theme.id}>
          <span><strong>{theme.id}</strong> {theme.name}<small className="muted">{theme.description}</small></span>
          <input type="radio" name="global-theme" value={theme.id} disabled />
        </label>)}
      </div>
      <label><input type="checkbox" disabled /> 모든 탭에 동일하게 적용</label>
    </section>

    <section className="card">
      <div className="section-title-row"><h3>탭별 디자인 설정</h3><span className="badge">추후 적용 예정</span></div>
      <div className="table-wrap"><table>
        <thead><tr><th>화면</th><th>디자인 스타일</th></tr></thead>
        <tbody>{navigationItems.map((item) => <tr key={item.to}>
          <td>{item.label}</td>
          <td><select defaultValue="V2" disabled aria-label={`${item.label} 디자인 스타일`}>
            {UI_THEMES.map((theme: { id: UiThemeId; name: string }) => <option key={theme.id} value={theme.id}>{theme.id} · {theme.name}</option>)}
          </select></td>
        </tr>)}</tbody>
      </table></div>
    </section>

    <div className="button-row">
      <button type="button" disabled>전체 초기화</button>
      <button type="button" disabled>미리보기</button>
      <button type="button" disabled>설정 적용하기</button>
    </div>
    <p className="muted">화면 스타일 저장과 적용 기능은 추후 제공될 예정입니다.</p>
  </>;
}
