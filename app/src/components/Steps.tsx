import React, { Children, cloneElement, isValidElement } from 'react';

/**
 * Steps / Step —— 用于渲染带编号圆圈和纵向连接线的分步教程。
 *
 * 用法：
 *   <Steps>
 *     <Step title="第 1 步">
 *       <p className="text-sm text-slate-600 dark:text-gray-300">...</p>
 *     </Step>
 *     <Step title="第 2 步">
 *       ...可以放任意 JSX
 *     </Step>
 *   </Steps>
 *
 * 视觉：红色圆圈 + 下方半透明竖线贯穿相邻步骤；最后一步自动不画线。
 * 布局要点：
 *   - `<Steps>` 外层包一层 div，避免父级 `space-y-*` 在各步骤行之间插入 margin，导致线断开。
 *   - 每一步内容列通过 `pb-5` 撑开行高；序号列靠 `align-items: stretch`（flex 默认）跟着变高，
 *     其中 `flex-1` 的竖线就会延伸到当前行底部、正好接到下一步圆圈顶部。
 */

interface StepIndexProps {
  num: number;
  isLast: boolean;
}

const StepIndex: React.FC<StepIndexProps> = ({ num, isLast }) => (
  // relative + self-stretch：让容器高度跟随当前行被 stretch 撑开，作为绝对定位线的参照。
  // 线用 absolute 精确定位：top-6 紧贴圆圈底边、-bottom-px 向下溢出 1px 进入下一行，
  // 避免 flex 布局的 subpixel 取整在圆圈顶部留下一道"瑕疵"。
  <div className="relative flex-shrink-0 w-6 self-stretch flex flex-col items-center">
    <div className="w-6 h-6 rounded-full bg-[#b71422] text-white flex items-center justify-center font-bold text-xs relative z-10">
      {num}
    </div>
    {!isLast && (
      <div
        aria-hidden="true"
        className="absolute left-1/2 -translate-x-1/2 top-6 -bottom-px w-0.5 bg-[#b71422]/25 dark:bg-[#b71422]/40"
      />
    )}
  </div>
);

export interface StepProps {
  /** 步骤标题，会渲染为加粗标题行 */
  title: React.ReactNode;
  /** 步骤正文，任意 JSX */
  children?: React.ReactNode;
  /**
   * 由 `<Steps>` 通过 cloneElement 注入，使用时不要手动传。
   * 以下划线前缀区分，避免误用。
   */
  _num?: number;
  _isFirst?: boolean;
  _isLast?: boolean;
}

export const Step: React.FC<StepProps> = ({
  title,
  children,
  _num = 1,
  _isFirst = false,
  _isLast = false,
}) => {
  return (
    <div className={`flex gap-3 ${_isFirst ? 'pt-4' : ''}`}>
      <StepIndex num={_num} isLast={_isLast} />
      <div className={`flex-1 ${_isLast ? '' : 'pb-5'}`}>
        <h3 className="font-bold text-slate-900 dark:text-white mb-1">{title}</h3>
        {children}
      </div>
    </div>
  );
};

export interface StepsProps {
  children: React.ReactNode;
  className?: string;
}

export const Steps: React.FC<StepsProps> = ({ children, className }) => {
  const items = Children.toArray(children).filter(isValidElement) as React.ReactElement<StepProps>[];
  const total = items.length;

  return (
    <div className={className}>
      {items.map((child, idx) =>
        cloneElement(child, {
          key: child.key ?? idx,
          _num: idx + 1,
          _isFirst: idx === 0,
          _isLast: idx === total - 1,
        }),
      )}
    </div>
  );
};
