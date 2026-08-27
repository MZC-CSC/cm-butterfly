/**
 * Which body values were forced into the type their task asks for.
 *
 * ★ 왜 저장소인가 — 이 사실은 워크플로우를 *열 때* 정해지는데, 보여줄 곳은 태스크를 눌러야
 *   열리는 속성 패널이다. 그 패널은 디자이너 라이브러리가 자기 스텝 객체로 띄우므로, 열 때
 *   손에 쥐고 있던 스텝에 표식을 남겨도 패널까지 오지 않는다 — 라이브러리가 정의를 복제한다.
 *   그래서 스텝을 거치지 않고 이름으로 주고받는다. 옆에 있는 referencePickingStore 와 같은
 *   이유, 같은 모양이다.
 */

import { computed, ref } from 'vue';

class CoercedFieldsStore {
  /** `<task> <field>` — 태스크 이름과 칸 경로. */
  private marked = ref<string[]>([]);

  private key(task: string, field: string): string {
    return `${task} ${field}`;
  }

  get all() {
    return computed(() => this.marked.value);
  }

  /** 이 워크플로우를 열며 바꾼 것들로 갈아 끼운다. */
  replace(entries: Array<{ task: string; field: string }>): void {
    this.marked.value = entries.map(one => this.key(one.task, one.field));
  }

  /** 이 태스크에서 바뀐 칸들. 패널이 이것만 본다. */
  fieldsOf(task: string): string[] {
    const prefix = `${task} `;
    return this.marked.value
      .filter(one => one.startsWith(prefix))
      .map(one => one.slice(prefix.length));
  }

  /** 다른 워크플로우를 열 때 남아 있으면 엉뚱한 칸이 표시된다. */
  clear(): void {
    this.marked.value = [];
  }
}

const coercedFieldsStore = new CoercedFieldsStore();

export default coercedFieldsStore;
