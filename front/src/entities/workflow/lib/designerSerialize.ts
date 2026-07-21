import { ITaskGroupResponse } from '@/entities/workflow/model/types';

/**
 * 화면에 그려진 그림을 워크플로우 정의로 옮긴다.
 *
 * **엔진에 남는 것은 선(`dependencies`)뿐이다.** TaskGroup 은 실행 단위가 아니라
 * 이름표이고, 상자를 어떻게 겹쳐 놨는지는 저장되지 않는다. 그래서 화면에서는 상자를
 * 얼마든지 겹쳐 쓸 수 있고(병렬 안의 갈래 안에 또 병렬), 저장할 때는 그 그림에서
 * 나오는 선만 그대로 뽑아내면 된다.
 *
 * 규칙은 두 줄이면 끝난다.
 *  - 한 줄로 놓인 것들은 앞의 것이 끝나야 다음이 시작한다
 *  - 병렬 상자 안의 갈래들은 **같은 지점에서 동시에** 시작하고, 다음 것은 **갈래의 끝을
 *    모두** 기다린다
 *
 * 화면 위치로 선을 다시 계산하지 않는다. 그린 대로 저장돼야 다시 열었을 때 같은 그림이
 * 나온다. 예전에는 배열 순서로 선을 새로 지어내서, 병렬 워크플로우를 **열어서 저장만
 * 해도** 병렬이 사라졌다.
 *
 * 여기는 *구조*만 다룬다. task 하나의 내용(spec·본문·타입)을 만드는 일은 화면 쪽 사정을
 * 알아야 하므로 `toTask` 로 받아서 부른다. 그래서 이 파일은 화면 없이 시험할 수 있다.
 */
export function serializeDesignerSequence<TStep extends DesignerStepLike>(
  sequence: TStep[],
  toTask: (step: TStep, dependencies: string[]) => any,
): ITaskGroupResponse[] {
  // 그룹은 이름표일 뿐이지만 저장 형식이 요구하므로, task 를 가장 가까운 상자 이름
  // 아래 모아 둔다. 상자가 없는 task 는 한 겹 감싼다.
  const groups: ITaskGroupResponse[] = [];
  const groupByName = new Map<string, ITaskGroupResponse>();

  const put = (boxName: string | null, description: string, task: any) => {
    const name = boxName ?? `__root_task_group_${task.name}__`;
    let group = boxName === null ? undefined : groupByName.get(name);
    if (!group) {
      group = {
        name,
        description:
          boxName === null
            ? 'Virtual task group for root-level task'
            : description,
        tasks: [],
      };
      groups.push(group);
      if (boxName !== null) groupByName.set(name, group);
    }
    group.tasks.push(task);
  };

  const descriptionOf = (step: TStep) =>
    (step.properties?.model as any)?.description ?? '';

  /** 한 줄로 놓인 것들. 앞의 출력이 다음의 입력이 된다. 반환값은 이 줄의 끝. */
  const walkSequence = (steps: TStep[], startsAfter: string[]): string[] => {
    let outputs = startsAfter;
    (steps ?? []).forEach(step => {
      outputs = walkStep(step, outputs);
    });
    return outputs;
  };

  /** 하나를 옮긴다. 반환값은 "다음 것이 기다려야 하는 task" 들. */
  const walkStep = (
    step: TStep,
    startsAfter: string[],
    boxName: string | null = null,
  ): string[] => {
    if (step.componentType === 'task') {
      put(boxName, '', toTask(step, startsAfter));
      return [step.name];
    }

    if (step.componentType === 'launchPad') {
      // 병렬 상자는 **갈라짐 표시이지 그룹이 아니다.** 그룹 상자 안에 있으면 안의
      // task 는 바깥 그룹으로 묶인다 — 한 그룹이 갈라진다고 다른 그룹이 되지는
      // 않는다. 바깥에 홀로 놓였을 때만 자기 이름이 묶는 이름이 된다.
      const groupName = boxName ?? step.name;
      // 갈래들은 모두 같은 지점에서 시작한다. 서로는 기다리지 않는다.
      const outs = (step.sequence ?? []).flatMap(child =>
        walkStep(child as TStep, startsAfter, groupName),
      );
      // 비어 있으면 아무것도 하지 않은 것이므로 앞의 출력을 그대로 흘려보낸다
      return outs.length ? outs : startsAfter;
    }

    // 상자(TaskGroup) — 안의 것들이 한 줄로 이어진다
    const inner = walkSequenceIn(
      (step.sequence ?? []) as TStep[],
      startsAfter,
      step.name,
      descriptionOf(step),
    );
    return inner;
  };

  const walkSequenceIn = (
    steps: TStep[],
    startsAfter: string[],
    boxName: string,
    description: string,
  ): string[] => {
    let outputs = startsAfter;
    steps.forEach(step => {
      if (step.componentType === 'task') {
        put(boxName, description, toTask(step, outputs));
        outputs = [step.name];
      } else {
        outputs = walkStep(step, outputs, boxName);
      }
    });
    return outputs;
  };

  walkSequence(sequence ?? [], []);
  return groups;
}

/**
 * 저장하기 전에 지금 그림이 워크플로우로 옮겨질 수 있는지 본다.
 *
 * 예전 검증기는 무엇을 받든 통과였고, 별도로 있던 검사 함수는 어디서도 불리지 않는
 * 죽은 코드였다. 옮길 수 없는 그림이 그대로 저장돼 다음에 열었을 때 달라 보이는
 * 원인이었다.
 *
 * 상자를 어떻게 겹쳐 놓든 선만 나오면 되므로 중첩 자체는 막지 않는다. 막는 것은
 * *선을 만들 수 없는* 경우뿐이다.
 */
export function validateDesignerSequence(
  sequence: DesignerStepLike[],
): string[] {
  const problems: string[] = [];
  const nameCounts = new Map<string, number>();

  const visit = (steps: DesignerStepLike[] | undefined) => {
    (steps ?? []).forEach(step => {
      if (step.componentType === 'task') {
        const name = String(step.name ?? '').trim();
        if (!name) {
          problems.push('There is a task with an empty name.');
          return;
        }
        nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
        return;
      }

      if (!countTasks(step)) {
        problems.push(`${step.name}: the box is empty and will not be saved.`);
      }
      visit(step.sequence);
    });
  };

  visit(sequence);

  [...nameCounts.entries()]
    .filter(([, count]) => count > 1)
    .forEach(([name]) =>
      problems.push(
        `Duplicate name: ${name} — names must be unique within a workflow.`,
      ),
    );

  if (!nameCounts.size) {
    problems.push('There is no task to run.');
  }

  return problems;
}

/**
 * 저장을 막지는 않지만 알려야 하는 것들.
 *
 * 갈래가 하나뿐인 병렬 상자가 대표적이다. 실행 결과는 그냥 한 줄로 놓은 것과 같아서
 * 틀리지는 않지만, **2갈래를 만들다 만 상태**일 가능성이 높다. 화면을 닫으면 그림은
 * 사라지고 저장된 선만 남으므로, 나가기 전에 짚어 준다.
 */
export function reviewDesignerSequence(sequence: DesignerStepLike[]): string[] {
  const notices: string[] = [];

  const visit = (steps: DesignerStepLike[] | undefined) => {
    (steps ?? []).forEach(step => {
      if (step.componentType === 'launchPad') {
        const branches = (step.sequence ?? []).filter(
          child => countTasks(child) > 0,
        );
        if (branches.length === 1) {
          notices.push(
            `${step.name}: only one branch — saving as is just links it into a single line. Add another branch or remove the box.`,
          );
        }
      }
      visit(step.sequence);
    });
  };

  visit(sequence);
  return notices;
}

/** 상자 안에 (몇 겹이든) task 가 들어 있는가 */
function countTasks(step: DesignerStepLike): number {
  if (step.componentType === 'task') return 1;
  return (step.sequence ?? []).reduce(
    (sum, child) => sum + countTasks(child),
    0,
  );
}

/** 화면에서 구조를 읽는 데 필요한 최소한의 모양 */
export interface DesignerStepLike {
  name: string;
  componentType: string;
  sequence?: DesignerStepLike[];
  properties?: { model?: object };
}
