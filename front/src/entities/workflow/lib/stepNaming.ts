/**
 * 화면에 새로 놓는 단계의 이름을 짓는다.
 *
 * 이름은 **워크플로우 하나 안에서만** 겹치지 않으면 된다. 엔진이 의존 관계를
 * 확인할 때 워크플로우 하나의 task 그룹만 받아서 보고, 실행 단계로 넘어갈 때는
 * 별도 식별자를 부여하고 이름은 그 식별자를 찾는 열쇠로만 쓴다. 서버 전체에서
 * 유일할 필요가 없다.
 *
 * 예전에는 이름 뒤에 네 자리 난수를 붙였다. 사람이 읽을 수 없는 이름이 되는 것도
 * 문제였지만, 더 큰 문제는 그 로직이 **저장된 워크플로우를 열 때도 돌아서** 이름을
 * 바꿔 버린 것이다. 다른 task 의 의존 관계는 옛 이름을 가리키고 있으므로 연결이
 * 끊어졌다. 게다가 이름 끝 네 자리를 잘라내는 처리 탓에 원래 그런 이름이던 task 도
 * 훼손됐다. 지금은 **화면에 새로 놓을 때만** 돌고, 순번을 붙인다.
 */

/** 현재 화면에 있는 모든 이름을 모은다 (중첩 포함) */
export function collectStepNames(
  steps: Array<any> | undefined,
  out: Set<string> = new Set(),
): Set<string> {
  (steps ?? []).forEach(step => {
    if (step?.name) out.add(String(step.name));
    collectStepNames(step?.sequence, out);
    Object.values(step?.branches ?? {}).forEach(branch =>
      collectStepNames(branch as Array<any>, out),
    );
  });
  return out;
}

/**
 * 쓰이지 않은 이름을 고른다 — `이름`, `이름2`, `이름3` 순으로 올라간다.
 *
 * 이미 순번이 붙은 이름을 다시 넣어도 순번이 겹쳐 쌓이지 않도록 끝의 숫자를 떼고
 * 시작한다. `sleep2` 를 복제하면 `sleep22` 가 아니라 `sleep3` 이 된다.
 */
export function nextAvailableName(
  baseName: string,
  taken: Set<string>,
): string {
  const base = String(baseName).replace(/\d+$/, '') || String(baseName);
  if (!taken.has(base)) return base;

  let n = 2;
  while (taken.has(`${base}${n}`)) n++;
  return `${base}${n}`;
}
