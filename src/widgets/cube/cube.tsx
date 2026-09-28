'use client';

import { Activity, type ReactNode, type TransitionEvent, useEffect, useRef } from 'react';

import { MESSENGER_ORDER } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';

import { useVisibleFaces } from './use-visible-faces';

import './cube.css';

interface CubeProps {
  activeMessenger: MessengerId;
  faces: Record<MessengerId, ReactNode>;
}

export function Cube({ activeMessenger, faces }: CubeProps) {
  const cubeRef = useRef<HTMLDivElement>(null);
  const { faces: visibleFaces, isSettled, settleFaces } = useVisibleFaces(activeMessenger);
  const isRotating = visibleFaces.length > 1;

  // Switching back before the browser picks up the change starts no transition, so no
  // transitionend would ever settle the faces.
  useEffect(() => {
    if (isRotating && !cubeRef.current?.getAnimations().some(isTransformTransition)) {
      settleFaces();
    }
  }, [activeMessenger, isRotating, settleFaces]);

  useEffect(() => {
    if (isSettled) {
      cubeRef.current
        ?.querySelector<HTMLElement>(`[data-messenger="${activeMessenger}"] h2`)
        ?.focus();
    }
  }, [activeMessenger, isSettled]);

  const handleCubeTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && event.propertyName === 'transform') {
      settleFaces();
    }
  };

  return (
    <div className="cube-scene">
      <div
        ref={cubeRef}
        className="cube"
        data-active={activeMessenger}
        data-rotating={isRotating}
        onTransitionEnd={handleCubeTransitionEnd}
      >
        {MESSENGER_ORDER.map((messengerId) => {
          const isVisible = visibleFaces.includes(messengerId);

          return (
            <section
              key={messengerId}
              className="cube-face"
              data-messenger={messengerId}
              hidden={!isVisible}
              inert={messengerId !== activeMessenger}
            >
              <div className="cube-face-content">
                <Activity mode={isVisible ? 'visible' : 'hidden'}>{faces[messengerId]}</Activity>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function isTransformTransition(animation: Animation) {
  return 'transitionProperty' in animation && animation.transitionProperty === 'transform';
}
