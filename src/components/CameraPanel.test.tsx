import {fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {CameraPanel} from './CameraPanel';
import {initialTracking,useWorkspace} from '../stores/workspace';
beforeEach(()=>useWorkspace.setState({tracking:initialTracking,preview:true}));
it('does not request a camera until the enable button is clicked',()=>{const enable=vi.fn();render(<CameraPanel service={null} enable={enable}/>);expect(enable).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Enable camera'}));expect(enable).toHaveBeenCalledTimes(1);});
it('exposes a recovery action for a camera failure',()=>{useWorkspace.setState({tracking:{...initialTracking,camera:'error',error:'No camera found.'}});const enable=vi.fn();render(<CameraPanel service={null} enable={enable}/>);expect(screen.getByRole('alert')).toHaveTextContent('No camera found.');fireEvent.click(screen.getByText('Try again'));expect(enable).toHaveBeenCalledOnce();});
it('collapses the preview without disabling the stream',()=>{render(<CameraPanel service={null} enable={vi.fn()}/>);fireEvent.click(screen.getByLabelText('Collapse camera preview'));expect(useWorkspace.getState().preview).toBe(false);expect(screen.queryByText('Your hands. Your controls.')).not.toBeInTheDocument();});
